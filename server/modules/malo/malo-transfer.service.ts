import "server-only";
import { BusinessLogicError } from "@/lib/errors";
import type { RequestActor } from "@/server/shared/request-context";
import { consumeRecipe } from "@/server/modules/levains/levain-consumption";
import { MaloRepository } from "./malo.repository";
import { transferSchema, type TransferMaloInput } from "./malo.schemas";
import {
  readDossier,
  checkSnapshot,
  assertCapacity,
  startEvent,
  finishMaloEvent,
  linkLot,
  decimal,
  invalidateComposition,
  protocolOf,
} from "./malo-operation";
import { readMaloControl } from "./malo-control.service";
export async function transferMalo(
  id: number,
  input: TransferMaloInput,
  actor: RequestActor,
) {
  const data = transferSchema.parse(input);
  return MaloRepository.withTransaction(async (tx) => {
    const p = await readDossier(tx, id, actor),
      source = await checkSnapshot(tx, data.source, actor),
      target = await checkSnapshot(tx, data.target, actor);
    const sourceRole = data.direction === "MR_TO_PCM" ? "MR" : "PCM",
      targetRole = data.direction === "MR_TO_PCM" ? "PCM" : "MR";
    if (
      source.maloPreparationId !== id ||
      target.maloPreparationId !== id ||
      source.maloRole !== sourceRole ||
      target.maloRole !== targetRole ||
      !source.currentContainerId ||
      !target.currentContainerId ||
      source.currentContainerId === target.currentContainerId
    )
      throw new BusinessLogicError(
        "Source et destination MR/PCM du dossier requises.",
        409,
      );
    const amount = decimal(data.volumeHl);
    if (amount.lte(0) || source.currentVolume.lt(amount))
      throw new BusinessLogicError(
        "Volume source insuffisant ou inférieur à la précision.",
        409,
      );
    for (const lot of [source, target]) {
      const composition = lot.maloCompositionEventId
        ? await tx.lotEvent.findFirst({
            where: {
              id: lot.maloCompositionEventId,
              organizationId: actor.organizationId,
            },
          })
        : null;
      if (composition && new Date(data.performedAt) < composition.eventDatetime)
        throw new BusinessLogicError(
          "Transfert antérieur à la composition de la source ou de la destination.",
          409,
        );
    }
    let control = null;
    if (data.direction === "MR_TO_PCM") {
      const profile = protocolOf(p.protocolSnapshot);
      control = await readMaloControl(tx, id, "MR", actor);
      if (profile.mrMalicThreshold != null) {
        const value = control.current?.extraData.malique;
        if (
          !control.representative ||
          typeof value !== "number" ||
          value >= profile.mrMalicThreshold ||
          data.analysisId !== control.current?.id
        )
          throw new BusinessLogicError(
            "Contrôle MR représentatif sous le seuil du protocole requis.",
            409,
          );
      }
      if (
        control.current &&
        new Date(data.performedAt) < new Date(control.current.analysisDate)
      )
        throw new BusinessLogicError(
          "Transfert antérieur au contrôle utilisé.",
          409,
        );
    }
    await assertCapacity(tx, target.currentContainerId, amount, actor);
    const e = await startEvent(
      tx,
      actor,
      id,
      data.direction === "MR_TO_PCM" ? "INCORPORATION_MR" : "DOUBLEMENT_MR",
      data.idempotencyKey,
      data.performedAt,
      data.notes,
    );
    await consumeRecipe(tx, actor, e.id, {
      lots: [
        {
          lotId: source.id,
          volumeHl: Number(amount),
          expectedVolumeHl: Number(source.currentVolume),
        },
      ],
      products: [],
    });
    const remaining = source.currentVolume.minus(amount);
    await tx.lot.update({
      where: { id: source.id },
      data: {
        status:
          sourceRole === "MR"
            ? remaining.isZero()
              ? "MR_TRANSFERE_TOTALEMENT"
              : "MR_TRANSFERE_PARTIELLEMENT"
            : remaining.isZero()
              ? "PCM_EPUISE"
              : source.status,
      },
    });
    await tx.lot.update({
      where: { id: target.id },
      data: {
        currentVolume: { increment: amount },
        status:
          targetRole === "PCM" ? "PCM_EN_DEVELOPPEMENT" : "MR_EN_REACTIVATION",
      },
    });
    await invalidateComposition(tx, target.id, id, e.id);
    await linkLot(tx, e.id, source, "SOURCE", amount.negated());
    await linkLot(tx, e.id, target, "CIBLE", amount);
    return finishMaloEvent(tx, e, actor, id, {
      direction: data.direction,
      sourceLotId: source.id,
      targetLotId: target.id,
      sourceContainerId: source.currentContainerId,
      targetContainerId: target.currentContainerId,
      volumeHl: Number(amount),
      remainingSourceHl: Number(remaining),
      targetBeforeHl: Number(target.currentVolume),
      targetAfterHl: Number(target.currentVolume.plus(amount)),
      control,
      confirmed: true,
      compositionEventId: e.id,
    });
  });
}
