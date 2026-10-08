import "server-only";
import { Prisma } from "@prisma/client";
import { BusinessLogicError } from "@/lib/errors";
import type { MaloSnapshot, MaloProtocol } from "@/lib/malo-types";
import type { RequestActor } from "@/server/shared/request-context";
import { reserveMaloRequest } from "./malo-dossier.service";
export type Tx = Prisma.TransactionClient;
export const decimal = (value: number) => new Prisma.Decimal(value.toFixed(3));
export const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
export async function readDossier(
  tx: Tx,
  id: number,
  actor: RequestActor,
  active = true,
) {
  const p = await tx.maloPreparation.findFirst({
    where: { id, organizationId: actor.organizationId },
    include: { lots: true },
  });
  if (!p) throw new BusinessLogicError("Dossier introuvable.", 404);
  if (active && p.status !== "EN_COURS")
    throw new BusinessLogicError("Dossier clôturé.", 409);
  return p;
}
export async function readLot(tx: Tx, id: number, actor: RequestActor) {
  const l = await tx.lot.findFirst({
    where: { id, organizationId: actor.organizationId },
    include: { currentContainer: true },
  });
  if (!l)
    throw new BusinessLogicError(
      "Lot introuvable dans votre organisation.",
      404,
    );
  if (l.currentVolumeUnit !== "hL")
    throw new BusinessLogicError("Le lot doit être exprimé en hL.", 409);
  return l;
}
export async function snapshotOf(
  tx: Tx,
  lot: Awaited<ReturnType<typeof readLot>>,
  actor: RequestActor,
): Promise<MaloSnapshot> {
  const event = await tx.lotEvent.findFirst({
    where: {
      organizationId: actor.organizationId,
      lots: { some: { lotId: lot.id } },
    },
    orderBy: { id: "desc" },
  });
  return {
    lotId: lot.id,
    volumeHl: Number(lot.currentVolume),
    status: lot.status,
    compositionEventId: lot.maloCompositionEventId,
    lastMutationEventId: event?.id ?? null,
  };
}
export async function checkSnapshot(
  tx: Tx,
  snapshot: MaloSnapshot,
  actor: RequestActor,
) {
  const l = await readLot(tx, snapshot.lotId, actor),
    actual = await snapshotOf(tx, l, actor);
  if (
    !l.currentVolume.equals(decimal(snapshot.volumeHl)) ||
    actual.status !== snapshot.status ||
    actual.compositionEventId !== snapshot.compositionEventId ||
    actual.lastMutationEventId !== snapshot.lastMutationEventId
  )
    throw new BusinessLogicError(
      "Le lot ou ses contrôles ont changé. Actualisez les données.",
      409,
    );
  return l;
}
export async function assertCapacity(
  tx: Tx,
  containerId: number,
  added: Prisma.Decimal,
  actor: RequestActor,
) {
  const c = await tx.container.findFirst({
    where: { id: containerId, organizationId: actor.organizationId },
    include: {
      currentLots: { where: { currentVolume: { gt: 0 } } },
      children: true,
    },
  });
  if (!c || c.children.length)
    throw new BusinessLogicError(
      "Choisissez un contenant ou compartiment individuel.",
      409,
    );
  if (
    !["hL", "L"].includes(c.capacityUnit) ||
    c.currentLots.some((l) => l.currentVolumeUnit !== "hL")
  )
    throw new BusinessLogicError("Unité de capacité incompatible.", 409);
  const capacity =
    c.capacityUnit === "L" ? c.capacityValue.div(100) : c.capacityValue;
  const occupied = c.currentLots.reduce(
    (s, l) => s.plus(l.currentVolume),
    new Prisma.Decimal(0),
  );
  if (occupied.plus(added).gt(capacity))
    throw new BusinessLogicError(
      `Capacité dépassée pour ${c.displayName}.`,
      409,
    );
  return c;
}
export async function startEvent(
  tx: Tx,
  actor: RequestActor,
  pid: number,
  action: string,
  key: string,
  date: string,
  notes?: string,
) {
  await reserveMaloRequest(tx, actor, key, action);
  return tx.lotEvent.create({
    data: {
      organizationId: actor.organizationId,
      operatorUserId: actor.userId,
      eventType: action,
      eventDatetime: new Date(date),
      comment: notes ?? null,
      metadata: {
        schemaVersion: 1,
        operation: action,
        preparationId: pid,
        idempotencyKey: key,
        operator: actor.email,
      },
    },
  });
}
export async function linkLot(
  tx: Tx,
  eventId: number,
  lot: Awaited<ReturnType<typeof readLot>>,
  role: string,
  volume: Prisma.Decimal,
) {
  await tx.lotEventLot.create({
    data: {
      eventId,
      lotId: lot.id,
      roleInEvent: role,
      volumeChange: volume,
      unit: "hL",
    },
  });
  if (lot.currentContainerId)
    await tx.lotEventContainer.create({
      data: { eventId, containerId: lot.currentContainerId, roleInEvent: role },
    });
}
export async function finishMaloEvent(
  tx: Tx,
  event: { id: number; eventType: string; metadata: Prisma.JsonValue },
  actor: RequestActor,
  pid: number,
  metadata: unknown,
) {
  const full = json({ ...json(event.metadata), ...json(metadata) });
  await tx.lotEvent.update({
    where: { id: event.id },
    data: { metadata: full },
  });
  await tx.auditLog.create({
    data: {
      organizationId: actor.organizationId,
      userId: actor.email,
      action: event.eventType,
      details: JSON.stringify({ eventId: event.id, ...full }),
    },
  });
  return { eventId: event.id, preparationId: pid };
}
export async function invalidateComposition(
  tx: Tx,
  lotId: number,
  pid: number,
  eventId: number,
) {
  const lot = await tx.lot.update({
    where: { id: lotId },
    data: { maloCompositionEventId: eventId },
  });
  if (lot.maloRole === "PCM")
    await tx.maloPreparation.update({
      where: { id: pid },
      data: { initialAnalysisId: null, referenceCompositionEventId: null },
    });
}
export function protocolOf(value: Prisma.JsonValue): MaloProtocol {
  return value as unknown as MaloProtocol;
}
