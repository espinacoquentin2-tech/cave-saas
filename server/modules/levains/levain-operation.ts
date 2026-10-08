import { isMaloLot } from '@/lib/malo';
import "server-only";
import { Prisma } from "@prisma/client";
import { BusinessLogicError } from "@/lib/errors";
import { getLevainState, roundLevain } from "@/lib/levain";
import { calculateLiqueurPreparation } from "@/lib/liqueur";
import { isTirageEligibleLotStatus } from "@/lib/tirage";
import type { RequestActor } from "@/server/shared/request-context";
import type {
  ExpectedLevainSnapshot,
  LiqueurSelection,
} from "@/lib/levain-types";
import {
  decimal,
  type RecipeDebits,
  consumeRecipe,
} from "./levain-consumption";
import type { Apports } from "./levain.schemas";
export type Tx = Prisma.TransactionClient;
export const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
export const MUTATION_EXCLUSIONS = ["OBSERVATION_LEVAIN", "CONTROLE_MIXTION"];
export async function readLot(tx: Tx, id: number, actor: RequestActor) {
  const lot = await tx.lot.findFirst({
    where: { id, organizationId: actor.organizationId },
    include: { currentContainer: true, components: true },
  });
  if (!lot)
    throw new BusinessLogicError(
      "Lot introuvable dans votre organisation.",
      404,
    );
  if (lot.currentVolumeUnit !== "hL")
    throw new BusinessLogicError("Volume en hL requis.", 409);
  return lot;
}
export async function readTankLot(tx: Tx, id: number, actor: RequestActor) {
  const tank = await tx.container.findFirst({
    where: { id, organizationId: actor.organizationId },
    include: { currentLots: { where: { currentVolume: { gt: 0 } } } },
  });
  if (!tank) throw new BusinessLogicError("Cuve introuvable.", 404);
  if (tank.capacityUnit !== "hL" || tank.currentLots.length !== 1)
    throw new BusinessLogicError(
      "La cuve doit contenir un seul lot positif en hL.",
      409,
    );
  return readLot(tx, tank.currentLots[0].id, actor);
}
export async function wineLot(tx: Tx, id: number, actor: RequestActor) {
  const lot = await readLot(tx, id, actor);
  if (
    isMaloLot(lot) || !isTirageEligibleLotStatus(lot.status) ||
    getLevainState(
      lot,
      /LEVAIN/i.test(lot.currentContainer?.displayName ?? ""),
    ) ||
    lot.qualiteLot === "MIXTION_TIRAGE"
  )
    throw new BusinessLogicError(
      "Choisir un vin de base ou d’assemblage.",
      409,
    );
  return lot;
}
export async function lastMutation(
  tx: Tx,
  lotId: number,
  organizationId: number,
) {
  return tx.lotEvent.findFirst({
    where: {
      organizationId,
      eventType: { notIn: MUTATION_EXCLUSIONS },
      lots: { some: { lotId } },
    },
    orderBy: { id: "desc" },
  });
}
export async function checkSnapshot(
  tx: Tx,
  snapshot: ExpectedLevainSnapshot,
  actor: RequestActor,
) {
  const lot = await readLot(tx, snapshot.lotId, actor),
    event = await lastMutation(tx, lot.id, actor.organizationId);
  if (
    !lot.currentVolume.equals(decimal(snapshot.volumeHl)) ||
    lot.status !== snapshot.status ||
    (event?.id ?? null) !== snapshot.lastMutationEventId
  )
    throw new BusinessLogicError(
      "Le lot ou ses contrôles ont changé. Actualisez les données.",
      409,
    );
  return lot;
}
export async function reserveRequest(
  tx: Tx,
  key: string,
  action: string,
  actor: RequestActor,
) {
  if (await tx.idempotencyRecord.findUnique({ where: { key } }))
    throw new BusinessLogicError(
      "Cette opération a déjà été enregistrée.",
      409,
    );
  await tx.idempotencyRecord.create({
    data: { key, action, userId: `${actor.organizationId}:${actor.userId}` },
  });
}
export async function createEvent(
  tx: Tx,
  action: string,
  actor: RequestActor,
  key: string,
  performedAt?: string,
) {
  await reserveRequest(tx, key, action, actor);
  return tx.lotEvent.create({
    data: {
      organizationId: actor.organizationId,
      operatorUserId: actor.userId,
      eventType: action,
      eventDatetime: performedAt ? new Date(performedAt) : new Date(),
      comment: action,
      metadata: { schemaVersion: 2, operation: action, idempotencyKey: key },
    },
  });
}
export async function finishEvent(
  tx: Tx,
  event: { id: number; eventType: string; metadata: Prisma.JsonValue },
  actor: RequestActor,
  targetId: number,
  added: number,
  recipe: unknown,
  debits: Awaited<ReturnType<typeof consumeRecipe>>,
) {
  for (const source of debits.lotDebits) {
    await tx.lotEventLot.create({
      data: {
        eventId: event.id,
        lotId: source.lotId,
        roleInEvent: "SOURCE",
        volumeChange: decimal(-source.volumeHl),
      },
    });
    if (source.containerId)
      await tx.lotEventContainer.create({
        data: {
          eventId: event.id,
          containerId: source.containerId,
          roleInEvent: "SOURCE",
        },
      });
  }
  await tx.lotEventLot.create({
    data: {
      eventId: event.id,
      lotId: targetId,
      roleInEvent: "CIBLE",
      volumeChange: decimal(added),
    },
  });
  const target = await tx.lot.findFirstOrThrow({
    where: { id: targetId, organizationId: actor.organizationId },
  });
  if (target.currentContainerId)
    await tx.lotEventContainer.create({
      data: {
        eventId: event.id,
        containerId: target.currentContainerId,
        roleInEvent: "CIBLE",
      },
    });
  const metadata = json({ ...json(event.metadata), recipe, ...debits });
  await tx.lotEvent.update({ where: { id: event.id }, data: { metadata } });
  await tx.auditLog.create({
    data: {
      organizationId: actor.organizationId,
      action: event.eventType,
      userId: actor.email,
      details: JSON.stringify({ eventId: event.id, ...metadata }),
    },
  });
  return {
    eventId: event.id,
    levainLotId: targetId,
    levainContainerId: target.currentContainerId,
    levainVolumeHl: Number(target.currentVolume),
    state: target.status,
    lastMutationEventId: event.id,
    ...debits,
  };
}
export async function liqueurDebits(
  tx: Tx,
  actor: RequestActor,
  selection: LiqueurSelection,
  volumeHl: number,
): Promise<{ debits: RecipeDebits; alcoholPct: number }> {
  if (selection.mode === "PREPARED")
    return {
      debits: {
        lots: [],
        products:
          volumeHl > 0
            ? [
                {
                  productId: selection.productId,
                  quantity: volumeHl,
                  unit: "hL",
                  kind: "LIQUEUR",
                },
              ]
            : [],
      },
      alcoholPct: selection.alcoholPct,
    };
  await wineLot(tx, selection.dissolutionLotId, actor);
  const r = calculateLiqueurPreparation(
    1,
    selection.sugarGfPerL,
    selection.dissolutionWineAlcoholPct,
  );
  if (!r) throw new BusinessLogicError("Recette de liqueur invalide.", 400);
  return {
    debits: {
      lots:
        volumeHl > 0
          ? [
              {
                lotId: selection.dissolutionLotId,
                volumeHl: roundLevain(r.dissolutionWineVolumeHl * volumeHl),
              },
            ]
          : [],
      products:
        volumeHl > 0
          ? [
              {
                productId: selection.sugarProductId,
                quantity: r.sugarKg * volumeHl,
                unit: "kg",
                kind: "SUGAR",
              },
            ]
          : [],
    },
    alcoholPct: r.alcoholPct,
  };
}
export async function apports(tx: Tx, actor: RequestActor, input: Apports) {
  const debits: RecipeDebits = { lots: [], products: [...input.products] };
  let source = null;
  if (input.volumeHl > 0) {
    if (!input.sourceContainerId)
      throw new BusinessLogicError("Choisir le vin source.", 400);
    source = await readTankLot(tx, input.sourceContainerId, actor);
    await wineLot(tx, source.id, actor);
    debits.lots.push({ lotId: source.id, volumeHl: input.volumeHl });
  }
  if (input.liqueur) {
    const q = await liqueurDebits(
      tx,
      actor,
      input.liqueur.selection,
      input.liqueur.volumeHl,
    );
    debits.lots.push(...q.debits.lots);
    debits.products.push(...q.debits.products);
  }
  const sugarKg = input.products
    .filter((p) => p.kind === "SUGAR")
    .reduce((total, p) => total + p.quantity * (p.unit === "g" ? 0.001 : 1), 0);
  const added = roundLevain(
    input.volumeHl +
      input.waterVolumeHl +
      (input.liqueur?.volumeHl ?? 0) +
      0.0063 * sugarKg,
  );
  return { debits, added, source };
}
