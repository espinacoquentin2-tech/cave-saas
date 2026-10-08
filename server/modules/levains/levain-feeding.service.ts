import "server-only";
import { BusinessLogicError } from "@/lib/errors";
import { calculateLevainFeeding, getLevainState } from "@/lib/levain";
import type { RequestActor } from "@/server/shared/request-context";
import { LevainRepository } from "./levain.repository";
import { feedLevainSchema, type FeedLevainInput } from "./levain.schemas";
import { decimal, consumeRecipe } from "./levain-consumption";
import {
  checkSnapshot,
  readTankLot,
  wineLot,
  liqueurDebits,
  createEvent,
  finishEvent,
} from "./levain-operation";
export class LevainFeedingService {
  static async feed(raw: FeedLevainInput, actor: RequestActor) {
    const input = feedLevainSchema.parse(raw);
    return LevainRepository.withTransaction(async (tx) => {
      const lot = await checkSnapshot(tx, input.snapshot, actor),
        state = getLevainState(lot);
      if (
        !["LEVAIN_PRET", "LEVAIN_EN_PROPAGATION"].includes(state ?? "") ||
        lot.currentContainerId !== input.levainContainerId ||
        !lot.currentVolume.equals(decimal(input.remainingVolumeHl))
      )
        throw new BusinessLogicError(
          "Le levain doit être qualifié ou en propagation, avec son volume actuel.",
          409,
        );
      const source = await readTankLot(tx, input.sourceContainerId, actor);
      await wineLot(tx, source.id, actor);
      const q = await liqueurDebits(tx, actor, input.liqueur, 1);
      const parameters = {
        ...input,
        liqueurSugarGPerL: input.liqueur.sugarGfPerL,
        liqueurAlcoholPct: q.alcoholPct,
      };
      const calculation = calculateLevainFeeding(parameters);
      if (!calculation)
        throw new BusinessLogicError(
          "Recette de nourrissage incohérente.",
          400,
        );
      if (
        !lot.currentContainer ||
        decimal(input.finalVolumeHl).gt(lot.currentContainer.capacityValue)
      )
        throw new BusinessLogicError("Capacité de la cuve dépassée.", 409);
      const liqueur = await liqueurDebits(
        tx,
        actor,
        input.liqueur,
        calculation.liqueurVolumeHl,
      );
      const event = await createEvent(
        tx,
        "ALIMENTATION_LEVAIN",
        actor,
        input.idempotencyKey,
        input.currentMeasuredAt,
      );
      const consumed = await consumeRecipe(tx, actor, event.id, {
        lots: [
          { lotId: source.id, volumeHl: calculation.wineVolumeHl },
          ...liqueur.debits.lots,
        ],
        products: [
          ...liqueur.debits.products,
          {
            productId: input.dapProductId,
            quantity: calculation.dapKg,
            unit: "kg",
            kind: "DAP",
          },
        ],
      });
      const updated = await tx.lot.updateMany({
        where: {
          id: lot.id,
          organizationId: actor.organizationId,
          currentVolume: lot.currentVolume,
          status: lot.status,
        },
        data: {
          currentVolume: decimal(input.finalVolumeHl),
          status: "LEVAIN_EN_PROPAGATION",
        },
      });
      if (updated.count !== 1)
        throw new BusinessLogicError("Le levain a changé.", 409);
      const result = await finishEvent(
        tx,
        event,
        actor,
        lot.id,
        calculation.addedVolumeHl,
        { parameters, calculation },
        consumed,
      );
      return {
        ...result,
        calculation,
        remainingSourceVolumeHl: consumed.lotDebits.find(
          (l) => l.lotId === source.id,
        )!.remainingVolumeHl,
      };
    });
  }
}
