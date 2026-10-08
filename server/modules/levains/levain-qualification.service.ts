import "server-only";
import { BusinessLogicError } from "@/lib/errors";
import { getLevainState } from "@/lib/levain";
import type { RequestActor } from "@/server/shared/request-context";
import { LevainRepository } from "./levain.repository";
import {
  qualifySchema,
  observationSchema,
  type QualifyLevainInput,
  type ObservationInput,
} from "./levain.schemas";
import {
  readLot,
  checkSnapshot,
  createEvent,
  finishEvent,
  json,
  type Tx,
} from "./levain-operation";
async function saveMeasures(
  tx: Tx,
  actor: RequestActor,
  lotId: number,
  date: string,
  measurements: ObservationInput["measurements"],
) {
  if (!measurements) return null;
  return tx.analysis.create({
    data: {
      organizationId: actor.organizationId,
      lotId,
      analysisDate: new Date(date),
      ph: measurements.ph,
      alcohol: measurements.alcoholPct,
      extraData: json(measurements),
    },
  });
}
export class LevainQualificationService {
  static async qualify(raw: QualifyLevainInput, actor: RequestActor) {
    const input = qualifySchema.parse(raw);
    return LevainRepository.withTransaction(async (tx) => {
      const lot = await checkSnapshot(tx, input.snapshot, actor),
        state = getLevainState(
          lot,
          /LEVAIN/i.test(lot.currentContainer?.displayName ?? ""),
        );
      if (!state || state === "ARCHIVE")
        throw new BusinessLogicError("Levain inutilisable.", 409);
      const history = await tx.lotEvent.findMany({
        where: {
          organizationId: actor.organizationId,
          lots: { some: { lotId: lot.id, roleInEvent: "CIBLE" } },
          eventType: {
            in: ["CREATION_LEVAIN", "PREPARATION_LEVAIN", "REPRISE_LEVAIN"],
          },
        },
      });
      if (state === "A_QUALIFIER") {
        if (!input.legacyResume || !input.protocol)
          throw new BusinessLogicError(
            "Reprise historique explicite requise.",
            409,
          );
      } else {
        if (input.legacyResume)
          throw new BusinessLogicError(
            "La reprise est réservée aux levains historiques.",
            409,
          );
        const recorded = history.some((e) => {
          const m = e.metadata as {
            productDebits?: Array<{ kind?: string }>;
          } | null;
          return (
            m?.productDebits?.some((p) => p.kind === "LSA") ||
            e.eventType === "REPRISE_LEVAIN"
          );
        });
        if (!recorded)
          throw new BusinessLogicError(
            "L’introduction des LSA doit être enregistrée avant qualification.",
            409,
          );
      }
      if (
        input.analysisIds.length !==
        (await tx.analysis.count({
          where: {
            organizationId: actor.organizationId,
            lotId: lot.id,
            id: { in: input.analysisIds },
          },
        }))
      )
        throw new BusinessLogicError(
          "Analyse inaccessible ou étrangère au levain.",
          404,
        );
      const event = await createEvent(
          tx,
          state === "A_QUALIFIER" ? "REPRISE_LEVAIN" : "QUALIFICATION_LEVAIN",
          actor,
          input.idempotencyKey,
          input.performedAt,
        ),
        analysis = await saveMeasures(
          tx,
          actor,
          lot.id,
          input.performedAt,
          input.measurements,
        );
      const changed = await tx.lot.updateMany({
        where: {
          id: lot.id,
          organizationId: actor.organizationId,
          currentVolume: lot.currentVolume,
          status: lot.status,
        },
        data: { status: "LEVAIN_PRET", qualiteLot: "LEVAIN" },
      });
      if (changed.count !== 1)
        throw new BusinessLogicError("Le levain a changé.", 409);
      return finishEvent(
        tx,
        event,
        actor,
        lot.id,
        0,
        { ...input, analysisId: analysis?.id },
        { lotDebits: [], productDebits: [] },
      );
    });
  }
  static async observe(raw: ObservationInput, actor: RequestActor) {
    const input = observationSchema.parse(raw);
    return LevainRepository.withTransaction(async (tx) => {
      const lot = await readLot(tx, input.lotId, actor);
      if (
        !getLevainState(
          lot,
          /LEVAIN/i.test(lot.currentContainer?.displayName ?? ""),
        )
      )
        throw new BusinessLogicError("Choisir un levain.", 409);
      const event = await createEvent(
          tx,
          "OBSERVATION_LEVAIN",
          actor,
          input.idempotencyKey,
          input.performedAt,
        ),
        analysis = await saveMeasures(
          tx,
          actor,
          lot.id,
          input.performedAt,
          input.measurements,
        );
      await finishEvent(
        tx,
        event,
        actor,
        lot.id,
        0,
        { ...input, analysisId: analysis?.id },
        { lotDebits: [], productDebits: [] },
      );
      return { eventId: event.id, analysisId: analysis?.id ?? null };
    });
  }
}
