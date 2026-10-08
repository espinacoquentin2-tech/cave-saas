import "server-only";
import { Prisma } from "@prisma/client";
import { BusinessLogicError } from "@/lib/errors";
import { isMaloSourceEligible, maloControlLabel } from "@/lib/malo";
import type { RequestActor } from "@/server/shared/request-context";
import { consumeRecipe } from "@/server/modules/levains/levain-consumption";
import { MaloRepository } from "./malo.repository";
import {
  distributeSchema,
  closeSchema,
  type DistributeMaloInput,
  type CloseMaloDossierInput,
} from "./malo.schemas";
import {
  readDossier,
  checkSnapshot,
  assertCapacity,
  startEvent,
  finishMaloEvent,
  linkLot,
  decimal,
} from "./malo-operation";
import { readMaloControl } from "./malo-control.service";
export async function distributeMalo(
  id: number,
  input: DistributeMaloInput,
  actor: RequestActor,
) {
  const data = distributeSchema.parse(input);
  return MaloRepository.withTransaction(async (tx) => {
    await readDossier(tx, id, actor);
    const pcm = await checkSnapshot(tx, data.snapshot, actor);
    if (
      pcm.maloPreparationId !== id ||
      pcm.maloRole !== "PCM" ||
      !pcm.currentContainerId
    )
      throw new BusinessLogicError("PCM disponible du dossier requis.", 409);
    const control = await readMaloControl(tx, id, "PCM", actor);
    if (
      !control.criterionReached ||
      control.initial?.id !== data.initialAnalysisId ||
      control.current?.id !== data.currentAnalysisId
    )
      throw new BusinessLogicError(
        maloControlLabel(control.reason) ||
          "Les deux tiers de malique ne sont pas consommés ou les analyses ont changé.",
        409,
      );
    if (new Date(data.performedAt) < new Date(control.current.analysisDate))
      throw new BusinessLogicError(
        "Distribution antérieure au contrôle utilisé.",
        409,
      );
    const total = data.destinations.reduce(
      (v, d) => v.plus(decimal(d.volumeHl)),
      new Prisma.Decimal(0),
    );
    if (
      total.lte(0) ||
      pcm.currentVolume.lt(total) ||
      data.destinations.some((d) => decimal(d.volumeHl).lte(0))
    )
      throw new BusinessLogicError(
        "Stock PCM insuffisant ou volume invalide.",
        409,
      );
    const targets = [];
    const byTank = new Map<number, Prisma.Decimal>();
    for (const d of data.destinations) {
      if (d.snapshot.lotId !== d.lotId)
        throw new BusinessLogicError("Lot cible et aperçu incompatibles.", 409);
      const l = await checkSnapshot(tx, d.snapshot, actor);
      if (
        !isMaloSourceEligible({
          ...l,
          currentVolume: Number(l.currentVolume),
        }) ||
        !l.currentContainerId ||
        l.currentContainerId === pcm.currentContainerId
      )
        throw new BusinessLogicError(
          "Cuve destinataire ordinaire requise.",
          409,
        );
      targets.push({ lot: l, volume: decimal(d.volumeHl) });
      byTank.set(
        l.currentContainerId,
        (byTank.get(l.currentContainerId) ?? decimal(0)).plus(
          decimal(d.volumeHl),
        ),
      );
    }
    for (const [tank, volume] of byTank)
      await assertCapacity(tx, tank, volume, actor);
    const e = await startEvent(
      tx,
      actor,
      id,
      "ENSEMENCEMENT_MALO",
      data.idempotencyKey,
      data.performedAt,
      data.notes,
    );
    await consumeRecipe(tx, actor, e.id, {
      lots: [
        {
          lotId: pcm.id,
          volumeHl: Number(total),
          expectedVolumeHl: Number(pcm.currentVolume),
        },
      ],
      products: [],
    });
    await linkLot(tx, e.id, pcm, "SOURCE", total.negated());
    const destinations = [];
    for (const { lot, volume } of targets) {
      await tx.lot.update({
        where: { id: lot.id },
        data: {
          currentVolume: { increment: volume },
          maloCompositionEventId: e.id,
        },
      });
      await linkLot(tx, e.id, lot, "CIBLE", volume);
      destinations.push({
        lotId: lot.id,
        lotCode: lot.businessCode,
        containerId: lot.currentContainerId,
        containerName: lot.currentContainer?.displayName,
        volumeBeforeHl: Number(lot.currentVolume),
        volumeHl: Number(volume),
        volumeAfterHl: Number(lot.currentVolume.plus(volume)),
        dosePct: volume.mul(100).div(lot.currentVolume).toNumber(),
      });
    }
    const remaining = pcm.currentVolume.minus(total);
    await tx.lot.update({
      where: { id: pcm.id },
      data: {
        status: remaining.isZero() ? "PCM_EPUISE" : "PCM_EN_DISTRIBUTION",
      },
    });
    return finishMaloEvent(tx, e, actor, id, {
      pcmLotId: pcm.id,
      pcmName: pcm.businessCode,
      pcmContainerId: pcm.currentContainerId,
      volumeHl: Number(total),
      remainingPcmHl: Number(remaining),
      destinations,
      control,
      confirmed: true,
    });
  });
}
export async function closeMaloDossier(
  id: number,
  input: CloseMaloDossierInput,
  actor: RequestActor,
) {
  const data = closeSchema.parse(input);
  return MaloRepository.withTransaction(async (tx) => {
    const p = await readDossier(tx, id, actor);
    if (
      data.snapshots.length !== p.lots.length ||
      new Set(data.snapshots.map((s) => s.lotId)).size !== p.lots.length
    )
      throw new BusinessLogicError(
        "Actualisez toutes les préparations du dossier.",
        409,
      );
    for (const s of data.snapshots) {
      if (!p.lots.some((l) => l.id === s.lotId))
        throw new BusinessLogicError("Préparation hors dossier.", 409);
      await checkSnapshot(tx, s, actor);
    }
    if (data.status === "TERMINE" && p.lots.some((l) => l.currentVolume.gt(0)))
      throw new BusinessLogicError(
        "Traitez les reliquats avant de terminer le dossier.",
        409,
      );
    const e = await startEvent(
      tx,
      actor,
      id,
      "CLOTURE_MALO",
      data.idempotencyKey,
      data.performedAt,
      data.notes,
    );
    await tx.maloPreparation.update({
      where: { id },
      data: { status: data.status },
    });
    return finishMaloEvent(tx, e, actor, id, {
      status: data.status,
      reliquats: p.lots.map((l) => ({
        lotId: l.id,
        volumeHl: Number(l.currentVolume),
      })),
    });
  });
}
