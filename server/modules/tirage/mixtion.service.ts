import "server-only";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { BusinessLogicError } from "@/lib/errors";
import { getLevainState, roundLevain } from "@/lib/levain";
import {
  calculateMixtionRecipe,
  MIXTION_NON_COMPOSITION_EVENTS,
} from "@/lib/mixtion";
import {
  assertRole,
  WRITE_ROLES,
  type RequestActor,
} from "@/server/shared/request-context";
import { LevainRepository } from "@/server/modules/levains/levain.repository";
import {
  checkSnapshot,
  wineLot,
  readLot,
  createEvent,
  finishEvent,
  liqueurDebits,
  json,
} from "@/server/modules/levains/levain-operation";
import {
  decimal,
  consumeRecipe,
  type RecipeDebits,
} from "@/server/modules/levains/levain-consumption";
import {
  createMixtionSchema,
  checkMixtionSchema,
  type CreateMixtionInput,
  type CheckMixtionInput,
} from "./mixtion.schemas";
export class MixtionService {
  static async create(raw: CreateMixtionInput, actor: RequestActor) {
    assertRole(actor, WRITE_ROLES);
    const input = createMixtionSchema.parse(raw);
    return LevainRepository.withTransaction(async (tx) => {
      const source = await wineLot(tx, input.sourceLotId, actor),
        levain = await checkSnapshot(tx, input.snapshot, actor);
      if (getLevainState(levain) !== "LEVAIN_PRET")
        throw new BusinessLogicError(
          "Qualifier le levain avant le prélèvement.",
          409,
        );
      const tank = await tx.container.findFirst({
        where: {
          id: input.destinationContainerId,
          organizationId: actor.organizationId,
        },
        include: { currentLots: { where: { currentVolume: { gt: 0 } } } },
      });
      if (!tank)
        throw new BusinessLogicError("Cuve de mixtion introuvable.", 404);
      if (
        tank.currentLots.length ||
        tank.capacityUnit !== "hL" ||
        tank.id === source.currentContainerId ||
        tank.id === levain.currentContainerId
      )
        throw new BusinessLogicError(
          "Choisir une cuve de destination vide en hL.",
          409,
        );
      const calculation = calculateMixtionRecipe({
        ...input,
        liqueurSugarGPerL: input.liqueur?.sugarGfPerL,
      });
      if (!calculation)
        throw new BusinessLogicError("Recette de mixtion incohérente.", 400);
      const volumeHl = roundLevain(calculation.volumeHl);
      if (decimal(volumeHl).gt(tank.capacityValue))
        throw new BusinessLogicError("Capacité de la mixtion dépassée.", 409);
      const debits: RecipeDebits = {
        lots: [
          { lotId: source.id, volumeHl: input.baseVolumeHl },
          {
            lotId: levain.id,
            volumeHl: input.levainVolumeHl,
            expectedVolumeHl: input.snapshot.volumeHl,
          },
        ],
        products: [...input.adjuvants],
      };
      if (calculation.sugarKg > 0)
        debits.products.push({
          productId: input.sugarProductId!,
          quantity: calculation.sugarKg,
          unit: "kg",
          kind: "SUGAR",
        });
      if (calculation.liqueurVolumeHl > 0) {
        const q = await liqueurDebits(
          tx,
          actor,
          input.liqueur!,
          roundLevain(calculation.liqueurVolumeHl),
        );
        debits.lots.push(...q.debits.lots);
        debits.products.push(...q.debits.products);
      }
      const event = await createEvent(
          tx,
          "CREATION_MIXTION",
          actor,
          input.idempotencyKey,
        ),
        consumed = await consumeRecipe(tx, actor, event.id, debits),
        suffix = randomUUID();
      const lot = await tx.lot.create({
        data: {
          organizationId: actor.organizationId,
          technicalCode: `MIX-${suffix}`,
          businessCode: `MIX-${source.year}-${suffix.slice(0, 12)}`,
          year: source.year,
          mainGrapeCode: source.mainGrapeCode,
          sequenceNumber: 1,
          status: "ASSEMBLE",
          qualiteLot: "MIXTION_TIRAGE",
          currentVolume: decimal(volumeHl),
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
      await finishEvent(
        tx,
        event,
        actor,
        lot.id,
        volumeHl,
        { ...input, calculation },
        consumed,
      );
      return {
        eventId: event.id,
        mixtionLotId: lot.id,
        mixtionContainerId: tank.id,
        volumeHl,
      };
    });
  }
  static async check(raw: CheckMixtionInput, actor: RequestActor) {
    assertRole(actor, WRITE_ROLES);
    const input = checkMixtionSchema.parse(raw);
    return LevainRepository.withTransaction(async (tx) => {
      const lot = await readLot(tx, input.lotId, actor);
      const creation = await tx.lotEvent.findFirst({
        where: {
          organizationId: actor.organizationId,
          eventType: { notIn: MIXTION_NON_COMPOSITION_EVENTS },
          lots: { some: { lotId: lot.id } },
        },
        orderBy: { id: "desc" },
      });
      if (
        lot.qualiteLot !== "MIXTION_TIRAGE" ||
        !lot.currentVolume.equals(
          new Prisma.Decimal(input.expectedVolumeHl.toFixed(5)),
        ) ||
        creation?.id !== input.lastMutationEventId
      )
        throw new BusinessLogicError(
          "La mixtion a changé. Actualisez ses contrôles.",
          409,
        );
      const event = await createEvent(
        tx,
        "CONTROLE_MIXTION",
        actor,
        input.idempotencyKey,
        input.performedAt,
      );
      await tx.lotEvent.update({
        where: { id: event.id },
        data: { metadata: json({ ...json(event.metadata), recipe: input }) },
      });
      await tx.lotEventLot.create({
        data: {
          eventId: event.id,
          lotId: lot.id,
          roleInEvent: "CIBLE",
          volumeChange: 0,
        },
      });
      await tx.analysis.create({
        data: {
          organizationId: actor.organizationId,
          lotId: lot.id,
          analysisDate: new Date(input.performedAt),
          extraData: json({
            wineDensity20: input.wineDensity20,
            mixtionDensity20: input.mixtionDensity20,
            operatorConfirmed: true,
          }),
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          action: "CONTROLE_MIXTION",
          userId: actor.email,
          details: JSON.stringify({ eventId: event.id, ...input }),
        },
      });
      return { eventId: event.id };
    });
  }
}
