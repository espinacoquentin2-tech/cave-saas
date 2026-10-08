import "server-only";
import { z } from "zod";
import type { Lot, Analysis } from "@prisma/client";
import { BusinessLogicError } from "@/lib/errors";
import { evaluateMaloControl } from "@/lib/malo";
import type { MaloRole, MaloAnalysis, MaloControlView } from "@/lib/malo-types";
import type { RequestActor } from "@/server/shared/request-context";
import { MaloRepository } from "./malo.repository";
import {
  readDossier,
  checkSnapshot,
  startEvent,
  finishMaloEvent,
  linkLot,
  decimal,
  type Tx,
} from "./malo-operation";
import {
  referenceSchema,
  homogenizeSchema,
  type SetMaloReferenceInput,
  type ConfirmMaloHomogenizationInput,
} from "./malo.schemas";
const contextSchema = z.object({
  schemaVersion: z.literal(1).optional(),
  preparationId: z.number().int().positive(),
  role: z.enum(["MR", "PCM"]),
  containerId: z.number().int().positive(),
  sampledAt: z.string().datetime({ offset: true }),
  compositionEventId: z.number().int().positive(),
});
export function validateMaloAnalysisContext(
  lot: Pick<
    Lot,
    | "id"
    | "maloRole"
    | "maloPreparationId"
    | "currentContainerId"
    | "maloCompositionEventId"
  >,
  context: unknown,
  compositionAt: Date,
) {
  const c = contextSchema.parse(context);
  if (
    c.preparationId !== lot.maloPreparationId ||
    c.role !== lot.maloRole ||
    c.containerId !== lot.currentContainerId ||
    c.compositionEventId !== lot.maloCompositionEventId ||
    new Date(c.sampledAt) < compositionAt
  )
    throw new BusinessLogicError(
      "Le prélèvement ne représente pas la composition actuelle de la préparation.",
      409,
    );
  return { ...c, schemaVersion: 1 };
}
export function analysisView(a: Analysis): MaloAnalysis {
  return {
    id: a.id,
    lotId: a.lotId,
    analysisDate: a.analysisDate.toISOString(),
    ph: a.ph,
    at: a.at,
    so2Free: a.so2Free,
    so2Total: a.so2Total,
    alcohol: a.alcohol,
    extraData: (a.extraData ?? {}) as Record<string, unknown>,
  };
}
function malic(a: Analysis | null): number | null {
  const x = (a?.extraData as Record<string, unknown> | null)?.malique;
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}
export async function readMaloControl(
  tx: Tx,
  preparationId: number,
  role: MaloRole,
  actor: RequestActor,
): Promise<MaloControlView> {
  const p = await readDossier(tx, preparationId, actor, false),
    l = p.lots.find((x) => x.maloRole === role);
  if (!l)
    return {
      ...evaluateMaloControl(null, null, false),
      initial: null,
      current: null,
      representative: false,
    };
  const analyses = await tx.analysis.findMany({
    where: { lotId: l.id, organizationId: actor.organizationId },
    orderBy: [{ analysisDate: "desc" }, { id: "desc" }],
  });
  const current = analyses[0] ?? null,
    initial =
      role === "PCM"
        ? (analyses.find((a) => a.id === p.initialAnalysisId) ?? null)
        : null;
  const composition = l.maloCompositionEventId
    ? await tx.lotEvent.findFirst({
        where: {
          id: l.maloCompositionEventId,
          organizationId: actor.organizationId,
        },
      })
    : null;
  const valid = (a: Analysis | null) => {
    if (!a || !composition) return false;
    try {
      validateMaloAnalysisContext(
        l,
        (a.extraData as Record<string, unknown>)?.malo,
        composition.eventDatetime,
      );
      return true;
    } catch {
      return false;
    }
  };
  const representative =
    valid(current) &&
    (role === "MR" ||
      (valid(initial) &&
        p.referenceCompositionEventId === l.maloCompositionEventId &&
        !!initial &&
        !!current &&
        current.analysisDate >= initial.analysisDate));
  return {
    ...evaluateMaloControl(malic(initial), malic(current), representative),
    ...(current && !valid(current)
      ? { reason: "CONTROLE_PERIME" as const }
      : {}),
    initial: initial ? analysisView(initial) : null,
    current: current ? analysisView(current) : null,
    representative,
  };
}
export async function confirmMaloHomogenization(
  id: number,
  input: ConfirmMaloHomogenizationInput,
  actor: RequestActor,
) {
  const data = homogenizeSchema.parse(input);
  return MaloRepository.withTransaction(async (tx) => {
    await readDossier(tx, id, actor);
    const l = await checkSnapshot(tx, data.snapshot, actor);
    if (
      l.maloPreparationId !== id ||
      l.maloRole !== "PCM" ||
      !l.maloCompositionEventId
    )
      throw new BusinessLogicError("PCM du dossier requis.", 409);
    const composition = await tx.lotEvent.findUniqueOrThrow({
      where: { id: l.maloCompositionEventId },
    });
    if (new Date(data.performedAt) < composition.eventDatetime)
      throw new BusinessLogicError(
        "Homogénéisation antérieure à la composition.",
        409,
      );
    const incorporated = await tx.lotEvent.findFirst({
      where: {
        organizationId: actor.organizationId,
        eventType: "INCORPORATION_MR",
        lots: { some: { lotId: l.id, roleInEvent: "CIBLE" } },
      },
    });
    if (!incorporated)
      throw new BusinessLogicError(
        "Incorporez le MR avant la référence initiale.",
        409,
      );
    const event = await startEvent(
      tx,
      actor,
      id,
      "HOMOGENEISATION_PCM",
      data.idempotencyKey,
      data.performedAt,
      data.notes,
    );
    await linkLot(tx, event.id, l, "CONTROLE", decimal(0));
    return finishMaloEvent(tx, event, actor, id, {
      compositionEventId: l.maloCompositionEventId,
      confirmed: true,
    });
  });
}
export async function setMaloInitialReference(
  id: number,
  input: SetMaloReferenceInput,
  actor: RequestActor,
) {
  const data = referenceSchema.parse(input);
  return MaloRepository.withTransaction(async (tx) => {
    await readDossier(tx, id, actor);
    const l = await checkSnapshot(tx, data.snapshot, actor);
    if (l.maloPreparationId !== id || l.maloRole !== "PCM")
      throw new BusinessLogicError("PCM du dossier requis.", 409);
    const a = await tx.analysis.findFirst({
      where: {
        id: data.analysisId,
        lotId: l.id,
        organizationId: actor.organizationId,
      },
    });
    if (!a || !(malic(a)! > 0))
      throw new BusinessLogicError("Référence malique positive requise.", 409);
    const composition = await tx.lotEvent.findUniqueOrThrow({
      where: { id: l.maloCompositionEventId! },
    });
    validateMaloAnalysisContext(
      l,
      (a.extraData as Record<string, unknown>)?.malo,
      composition.eventDatetime,
    );
    const homogeneous = await tx.lotEvent.findFirst({
      where: {
        organizationId: actor.organizationId,
        eventType: "HOMOGENEISATION_PCM",
        lots: { some: { lotId: l.id } },
        metadata: {
          path: ["compositionEventId"],
          equals: l.maloCompositionEventId!,
        },
      },
      orderBy: { id: "desc" },
    });
    if (!homogeneous || a.analysisDate < homogeneous.eventDatetime)
      throw new BusinessLogicError(
        "Prélèvement requis après incorporation et homogénéisation du MR.",
        409,
      );
    const event = await startEvent(
      tx,
      actor,
      id,
      "REFERENCE_INITIALE_PCM",
      data.idempotencyKey,
      data.performedAt,
      data.notes,
    );
    await linkLot(tx, event.id, l, "CONTROLE", decimal(0));
    await tx.maloPreparation.update({
      where: { id },
      data: {
        initialAnalysisId: a.id,
        referenceCompositionEventId: l.maloCompositionEventId,
      },
    });
    return finishMaloEvent(tx, event, actor, id, {
      analysisId: a.id,
      malique: malic(a),
      sampledAt: a.analysisDate,
      compositionEventId: l.maloCompositionEventId,
    });
  });
}
