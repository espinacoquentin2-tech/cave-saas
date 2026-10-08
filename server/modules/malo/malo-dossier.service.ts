import "server-only";
import { Prisma } from "@prisma/client";
import { BusinessLogicError } from "@/lib/errors";
import { getMaloProtocol } from "@/lib/malo-protocols";
import { isMaloSourceEligible } from "@/lib/malo";
import type { RequestActor } from "@/server/shared/request-context";
import { MaloRepository } from "./malo.repository";
import {
  createDossierSchema,
  updateDossierSchema,
  type CreateMaloDossierInput,
  type UpdateMaloDossierInput,
} from "./malo.schemas";
export async function reserveMaloRequest(
  tx: Prisma.TransactionClient,
  actor: RequestActor,
  key: string,
  action: string,
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
async function checkDestinations(
  tx: Prisma.TransactionClient,
  items: Array<{ lotId: number }>,
  actor: RequestActor,
) {
  const lots = await tx.lot.findMany({
    where: {
      id: { in: items.map((x) => x.lotId) },
      organizationId: actor.organizationId,
    },
    include: { currentContainer: true },
  });
  if (
    lots.length !== items.length ||
    lots.some(
      (l) =>
        !isMaloSourceEligible({ ...l, currentVolume: Number(l.currentVolume) }),
    )
  )
    throw new BusinessLogicError(
      "Destinataire invalide dans votre organisation.",
    );
}
export async function createMaloDossier(
  input: CreateMaloDossierInput,
  actor: RequestActor,
) {
  const data = createDossierSchema.parse(input);
  return MaloRepository.withTransaction(async (tx) => {
    await reserveMaloRequest(
      tx,
      actor,
      data.idempotencyKey,
      "CREATION_DOSSIER_MALO",
    );
    await checkDestinations(tx, data.plannedDestinations, actor);
    const protocol = data.protocol ?? getMaloProtocol(data.profile);
    if (protocol.profile !== data.profile)
      throw new BusinessLogicError("Profil et paramètres incompatibles.");
    const row = await tx.maloPreparation.create({
      data: {
        organizationId: actor.organizationId,
        creatorUserId: actor.userId,
        name: data.name,
        year: data.year,
        plannedVolumeHl: data.plannedVolumeHl,
        dosePct: data.dosePct,
        notes: data.notes,
        protocolSnapshot: protocol,
        plannedDestinations: data.plannedDestinations,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.email,
        action: "CREATION_DOSSIER_MALO",
        details: `Dossier ${row.id}`,
      },
    });
    const event = await tx.lotEvent.create({
      data: {
        organizationId: actor.organizationId,
        operatorUserId: actor.userId,
        eventType: "CREATION_DOSSIER_MALO",
        metadata: {
          schemaVersion: 1,
          preparationId: row.id,
          idempotencyKey: data.idempotencyKey,
          operator: actor.email,
        },
      },
    });
    return { preparationId: row.id, eventId: event.id };
  });
}
export async function updateMaloDossier(
  id: number,
  input: UpdateMaloDossierInput,
  actor: RequestActor,
) {
  const data = updateDossierSchema.parse(input);
  return MaloRepository.withTransaction(async (tx) => {
    const row = await tx.maloPreparation.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!row) throw new BusinessLogicError("Dossier introuvable.", 404);
    if (row.status !== "EN_COURS")
      throw new BusinessLogicError("Dossier clôturé.", 409);
    await reserveMaloRequest(
      tx,
      actor,
      data.idempotencyKey,
      "MODIFICATION_DOSSIER_MALO",
    );
    if (data.plannedDestinations)
      await checkDestinations(tx, data.plannedDestinations, actor);
    const { idempotencyKey, ...changes } = data;
    await tx.maloPreparation.update({ where: { id }, data: changes });
    await tx.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.email,
        action: "MODIFICATION_DOSSIER_MALO",
        details: JSON.stringify({
          preparationId: id,
          idempotencyKey,
          ...changes,
        }),
      },
    });
    await tx.lotEvent.create({
      data: {
        organizationId: actor.organizationId,
        operatorUserId: actor.userId,
        eventType: "MODIFICATION_DOSSIER_MALO",
        metadata: {
          schemaVersion: 1,
          preparationId: id,
          idempotencyKey,
          changes,
        },
      },
    });
  });
}
