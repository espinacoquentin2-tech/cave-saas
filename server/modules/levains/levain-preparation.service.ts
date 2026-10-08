import "server-only";
import { randomUUID } from "node:crypto";
import { BusinessLogicError } from "@/lib/errors";
import type { RequestActor } from "@/server/shared/request-context";
import { getLevainState } from "@/lib/levain";
import { LevainRepository } from "./levain.repository";
import {
  createLevainSchema,
  preparationSchema,
  type CreateLevainInput,
  type PreparationInput,
} from "./levain.schemas";
import { decimal, consumeRecipe } from "./levain-consumption";
import {
  apports,
  checkSnapshot,
  createEvent,
  finishEvent,
} from "./levain-operation";
export class LevainPreparationService {
  static async create(raw: CreateLevainInput, actor: RequestActor) {
    const input = createLevainSchema.parse(raw);
    return LevainRepository.withTransaction(async (tx) => {
      const recipe = await apports(tx, actor, input);
      if (!recipe.source)
        throw new BusinessLogicError("Vin source requis.", 400);
      let tank: import("@prisma/client").Container | null;
      if (input.destinationContainerId) {
        tank = await tx.container.findFirst({
          where: {
            id: input.destinationContainerId,
            organizationId: actor.organizationId,
          },
          include: { currentLots: true },
        });
        if (!tank) throw new BusinessLogicError("Cuve introuvable.", 404);
        if (
          (await tx.lot.count({
            where: { currentContainerId: tank.id, currentVolume: { gt: 0 } },
          })) ||
          tank.capacityUnit !== "hL"
        )
          throw new BusinessLogicError(
            "Cuve de destination indisponible.",
            409,
          );
      } else
        tank = await tx.container.create({
          data: {
            organizationId: actor.organizationId,
            code: `LEV-${randomUUID()}`,
            displayName: "Cuve Levain",
            type: "CUVE_INOX",
            capacityValue: decimal(input.capacityHl!),
            capacityUnit: "hL",
            status: "VIDE",
          },
        });
      if (decimal(recipe.added).gt(tank.capacityValue))
        throw new BusinessLogicError("Capacité dépassée.", 409);
      const event = await createEvent(
        tx,
        "CREATION_LEVAIN",
        actor,
        input.idempotencyKey,
        input.step.performedAt,
      );
      const source = recipe.source,
        suffix = randomUUID();
      const lot = await tx.lot.create({
        data: {
          organizationId: actor.organizationId,
          technicalCode: `LEV-${suffix}`,
          businessCode: `LEV-${source.year}-${suffix.slice(0, 12)}`,
          year: source.year,
          mainGrapeCode: source.mainGrapeCode,
          sequenceNumber: 1,
          status: "LEVAIN_EN_PREPARATION",
          qualiteLot: "LEVAIN",
          currentVolume: decimal(recipe.added),
          currentContainerId: tank.id,
          components: {
            create: source.components.map((c) => ({
              grapeCode: c.grapeCode,
              percentage: c.percentage,
            })),
          },
        },
      });
      await tx.container.update({
        where: { id: tank.id },
        data: { status: "PLEIN" },
      });
      const consumed = await consumeRecipe(tx, actor, event.id, recipe.debits);
      const result = await finishEvent(
        tx,
        event,
        actor,
        lot.id,
        recipe.added,
        input,
        consumed,
      );
      return {
        ...result,
        remainingSourceVolumeHl: consumed.lotDebits.find(
          (l) => l.lotId === source.id,
        )!.remainingVolumeHl,
      };
    });
  }
  static async prepare(raw: PreparationInput, actor: RequestActor) {
    const input = preparationSchema.parse(raw);
    return LevainRepository.withTransaction(async (tx) => {
      const lot = await checkSnapshot(tx, input.snapshot, actor);
      if (getLevainState(lot) !== "LEVAIN_EN_PREPARATION")
        throw new BusinessLogicError(
          "Le levain n’est pas en préparation.",
          409,
        );
      const recipe = await apports(tx, actor, input),
        final = lot.currentVolume.plus(decimal(recipe.added));
      if (!lot.currentContainer || final.gt(lot.currentContainer.capacityValue))
        throw new BusinessLogicError("Capacité dépassée.", 409);
      const event = await createEvent(
          tx,
          "PREPARATION_LEVAIN",
          actor,
          input.idempotencyKey,
          input.step.performedAt,
        ),
        consumed = await consumeRecipe(tx, actor, event.id, recipe.debits);
      const changed = await tx.lot.updateMany({
        where: {
          id: lot.id,
          organizationId: actor.organizationId,
          currentVolume: lot.currentVolume,
          status: lot.status,
        },
        data: { currentVolume: final },
      });
      if (changed.count !== 1)
        throw new BusinessLogicError("Le levain a changé.", 409);
      return finishEvent(
        tx,
        event,
        actor,
        lot.id,
        recipe.added,
        input,
        consumed,
      );
    });
  }
}
