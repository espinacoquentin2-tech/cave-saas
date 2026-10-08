import "server-only";
import { BusinessLogicError } from "@/lib/errors";
import { isMaloSourceEligible } from "@/lib/malo";
import type { MaloRecipe } from "@/lib/malo-types";
import type { RequestActor } from "@/server/shared/request-context";
import { consumeRecipe } from "@/server/modules/levains/levain-consumption";
import { MaloRepository } from "./malo.repository";
import {
  prepareSchema,
  inputsSchema,
  stepSchema,
  type PrepareMaloLotInput,
  type AddMaloInputsInput,
  type RecordMaloStepInput,
} from "./malo.schemas";
import {
  readDossier,
  readLot,
  checkSnapshot,
  assertCapacity,
  startEvent,
  finishMaloEvent,
  linkLot,
  decimal,
  invalidateComposition,
  type Tx,
} from "./malo-operation";
async function recipeDebits(
  tx: Tx,
  pid: number,
  recipe: MaloRecipe,
  actor: RequestActor,
  targetContainerId: number,
  eventId: number,
) {
  for (const volume of [
    recipe.waterVolumeHl,
    ...recipe.products.map((p) => p.addedVolumeHl),
  ]) {
    if (volume > 0 && decimal(volume).lte(0))
      throw new BusinessLogicError(
        "Volume ajouté inférieur à la précision de 0,001 hL.",
        400,
      );
  }
  for (const s of recipe.sources) {
    const l = await readLot(tx, s.lotId, actor);
    if (
      !isMaloSourceEligible({ ...l, currentVolume: Number(l.currentVolume) }) ||
      l.currentContainerId === targetContainerId
    )
      throw new BusinessLogicError(
        "Source de moût ou vin ordinaire requise.",
        409,
      );
  }
  const added = recipe.sources
    .reduce(
      (n, s) => n.plus(decimal(s.volumeHl)),
      decimal(recipe.waterVolumeHl),
    )
    .plus(
      recipe.products.reduce(
        (n, p) => n.plus(decimal(p.addedVolumeHl)),
        decimal(0),
      ),
    );
  const debits = await consumeRecipe(tx, actor, eventId, {
    lots: recipe.sources.map((s) => ({ ...s })),
    products: recipe.products.map((p) => ({
      productId: p.productId,
      quantity: p.quantity,
      unit: p.unit,
      kind: p.role === "LSA" ? "LSA" : "OTHER",
    })),
  });
  for (const s of debits.lotDebits) {
    const l = await readLot(tx, s.lotId, actor);
    await linkLot(
      tx,
      eventId,
      { ...l, currentContainerId: s.containerId },
      "SOURCE",
      decimal(-s.volumeHl),
    );
  }
  return { added, debits };
}
export async function prepareMaloLot(
  id: number,
  input: PrepareMaloLotInput,
  actor: RequestActor,
) {
  const data = prepareSchema.parse(input);
  return MaloRepository.withTransaction(async (tx) => {
    const p = await readDossier(tx, id, actor);
    if (p.lots.some((l) => l.maloRole === data.role))
      throw new BusinessLogicError(
        "Ce dossier possède déjà cette préparation.",
        409,
      );
    const c = await assertCapacity(
      tx,
      data.destinationContainerId,
      decimal(0),
      actor,
    );
    if (c.currentLots.length || c.status !== "VIDE")
      throw new BusinessLogicError(
        "Choisissez un contenant vide et prêt.",
        409,
      );
    const e = await startEvent(
      tx,
      actor,
      id,
      `PREPARATION_${data.role}`,
      data.idempotencyKey,
      data.performedAt,
      data.notes,
    );
    const { added, debits } = await recipeDebits(
      tx,
      id,
      data.recipe,
      actor,
      c.id,
      e.id,
    );
    if (added.lte(0))
      throw new BusinessLogicError(
        "Un volume de préparation positif est requis.",
      );
    await assertCapacity(tx, c.id, added, actor);
    const firstSource = data.recipe.sources[0]
      ? await readLot(tx, data.recipe.sources[0].lotId, actor)
      : null;
    const l = await tx.lot.create({
      data: {
        organizationId: actor.organizationId,
        technicalCode: `MALO-${id}-${data.role}-${e.id}`,
        businessCode: `${data.name} · ${id}-${data.role}`,
        year: p.year,
        mainGrapeCode: firstSource?.mainGrapeCode ?? "MULTI",
        sequenceNumber: 1,
        status: `${data.role}_EN_PREPARATION`,
        currentVolume: added,
        currentContainerId: c.id,
        maloPreparationId: id,
        maloRole: data.role,
        maloCompositionEventId: e.id,
        notes: data.notes,
      },
    });
    await tx.container.update({
      where: { id: c.id },
      data: { usage: data.role, status: "PLEIN" },
    });
    await linkLot(tx, e.id, { ...l, currentContainer: c }, "CIBLE", added);
    return finishMaloEvent(tx, e, actor, id, {
      role: data.role,
      recipe: data.recipe,
      ...debits,
      targetLotId: l.id,
      targetContainerId: c.id,
      volumeBeforeHl: 0,
      volumeAfterHl: Number(added),
      compositionEventId: e.id,
    });
  });
}
export async function addMaloInputs(
  id: number,
  input: AddMaloInputsInput,
  actor: RequestActor,
) {
  const data = inputsSchema.parse(input);
  return MaloRepository.withTransaction(async (tx) => {
    await readDossier(tx, id, actor);
    const l = await checkSnapshot(tx, data.snapshot, actor);
    if (
      l.maloPreparationId !== id ||
      !l.currentContainerId ||
      l.currentVolume.lte(0)
    )
      throw new BusinessLogicError(
        "Préparation active du dossier requise.",
        409,
      );
    const composition = l.maloCompositionEventId
      ? await tx.lotEvent.findUnique({
          where: { id: l.maloCompositionEventId },
        })
      : null;
    if (composition && new Date(data.performedAt) < composition.eventDatetime)
      throw new BusinessLogicError(
        "Apport antérieur à la composition courante.",
        409,
      );
    const e = await startEvent(
      tx,
      actor,
      id,
      `APPORTS_${l.maloRole}`,
      data.idempotencyKey,
      data.performedAt,
      data.notes,
    );
    const { added, debits } = await recipeDebits(
      tx,
      id,
      data.recipe,
      actor,
      l.currentContainerId,
      e.id,
    );
    if (added.isZero() && !data.recipe.products.length)
      throw new BusinessLogicError("Aucun apport à enregistrer.");
    await assertCapacity(tx, l.currentContainerId, added, actor);
    await tx.lot.update({
      where: { id: l.id },
      data: {
        currentVolume: { increment: added },
        status:
          l.maloRole === "MR" ? "MR_EN_REACTIVATION" : "PCM_EN_DEVELOPPEMENT",
      },
    });
    await invalidateComposition(tx, l.id, id, e.id);
    await linkLot(tx, e.id, l, "CIBLE", added);
    return finishMaloEvent(tx, e, actor, id, {
      role: l.maloRole,
      recipe: data.recipe,
      ...debits,
      targetLotId: l.id,
      volumeBeforeHl: Number(l.currentVolume),
      volumeAfterHl: Number(l.currentVolume.plus(added)),
      compositionEventId: e.id,
    });
  });
}
export async function recordMaloStep(
  id: number,
  input: RecordMaloStepInput,
  actor: RequestActor,
) {
  const data = stepSchema.parse(input);
  return MaloRepository.withTransaction(async (tx) => {
    await readDossier(tx, id, actor);
    const l = await checkSnapshot(tx, data.snapshot, actor);
    if (l.maloPreparationId !== id || !l.maloRole)
      throw new BusinessLogicError("Préparation du dossier requise.", 409);
    const legal =
      l.maloRole === "MR"
        ? ["MR_EN_PREPARATION", "MR_EN_REACTIVATION"]
        : ["PCM_EN_PREPARATION", "PCM_EN_FA", "PCM_EN_DEVELOPPEMENT"];
    if (data.state && (!legal.includes(data.state) || l.currentVolume.lte(0)))
      throw new BusinessLogicError(
        "Transition non autorisée. Les transferts et distributions utilisent leurs actions dédiées.",
        409,
      );
    const e = await startEvent(
      tx,
      actor,
      id,
      "ETAPE_MALO",
      data.idempotencyKey,
      data.performedAt,
      data.notes ?? data.observation,
    );
    await linkLot(tx, e.id, l, "OBSERVATION", decimal(0));
    if (data.state)
      await tx.lot.update({
        where: { id: l.id },
        data: { status: data.state },
      });
    return finishMaloEvent(tx, e, actor, id, {
      role: l.maloRole,
      state: data.state ?? l.status,
      observation: data.observation,
      compositionEventId: l.maloCompositionEventId,
    });
  });
}
