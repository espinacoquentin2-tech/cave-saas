import { Prisma } from '@prisma/client';
import { BusinessLogicError } from '@/lib/errors';
import { CreateLossInput } from '@/server/modules/losses/loss.schemas';
import { LossRepository } from '@/server/modules/losses/loss.repository';
import { RequestActor } from '@/server/shared/request-context';

interface LossResult {
  entityType: 'BOTTLE' | 'BULK';
  entityId: number;
  remainingQuantity: number;
}

const toDecimal = (value: number) => new Prisma.Decimal(value.toFixed(3));
const toNumber = (value: Prisma.Decimal | number) => Number(value);

export class LossModuleService {
  static async execute(input: CreateLossInput, actor: RequestActor): Promise<LossResult> {
    return LossRepository.withTransaction(async (tx) => {
      const existingRequest = await LossRepository.findIdempotencyRecord(tx, input.idempotencyKey);
      if (existingRequest) {
        throw new BusinessLogicError('Cette déclaration de perte a déjà été traitée.', 409);
      }

      const operator = await LossRepository.findUserByEmail(tx, actor.email);
      if (!operator) {
        throw new BusinessLogicError('Utilisateur opérateur introuvable.', 401);
      }

      const eventDatetime = new Date();
      const isDistillerie = input.entityType === 'BULK' && input.note.toUpperCase().includes('DISTILLERIE');

      if (input.entityType === 'BULK') {
        const lot = await LossRepository.findLot(tx, input.entityId);
        if (!lot) {
          throw new BusinessLogicError('Lot vrac introuvable.', 404);
        }

        if (toNumber(lot.currentVolume) < input.amount) {
          throw new BusinessLogicError(
            `Volume insuffisant. Disponible: ${toNumber(lot.currentVolume)} hL, demandé: ${input.amount} hL.`,
            409,
          );
        }

        const decrementResult = await LossRepository.decrementLot(tx, lot.id, toDecimal(input.amount));
        if (decrementResult.count !== 1) {
          throw new BusinessLogicError(
            'Le volume du lot a changé pendant l\'opération. Rechargez les données puis réessayez.',
            409,
          );
        }

        const remainingQuantity = Number((toNumber(lot.currentVolume) - input.amount).toFixed(3));
        if (remainingQuantity <= 0) {
          await LossRepository.updateLotStatus(tx, lot.id, 'ARCHIVE');
          if (lot.currentContainerId) {
            await LossRepository.updateContainerStatus(tx, lot.currentContainerId, 'NETTOYAGE');
          }
        }

        const event = await LossRepository.createLotEvent(tx, {
          eventType: isDistillerie ? 'DISTILLERIE' : 'PERTE',
          operatorUserId: operator.id,
          eventDatetime,
          comment: input.note,
        });

        await LossRepository.createLotEventLink(tx, {
          eventId: event.id,
          lotId: lot.id,
          roleInEvent: 'SOURCE',
          volumeChange: toDecimal(input.amount),
        });

        await LossRepository.createIdempotencyRecord(tx, input.idempotencyKey, actor.email);
        await LossRepository.createAuditLog(tx, {
          action: isDistillerie ? 'DISTILLERY_DECLARATION' : 'LOSS_DECLARATION',
          details: `${input.amount} hL déclarés sur le lot ${lot.businessCode} par ${actor.email}.`,
          userId: actor.email,
        });

        return {
          entityType: input.entityType,
          entityId: lot.id,
          remainingQuantity,
        };
      }

      const bottleLot = await LossRepository.findBottleLot(tx, input.entityId);
      if (!bottleLot) {
        throw new BusinessLogicError('Lot de bouteilles introuvable.', 404);
      }

      if (bottleLot.currentBottleCount < input.amount) {
        throw new BusinessLogicError(
          `Stock insuffisant. Disponible: ${bottleLot.currentBottleCount} btl, demandé: ${input.amount} btl.`,
          409,
        );
      }

      const decrementResult = await LossRepository.decrementBottleLot(tx, bottleLot.id, input.amount);
      if (decrementResult.count !== 1) {
        throw new BusinessLogicError(
          'Le stock bouteilles a changé pendant l\'opération. Rechargez les données puis réessayez.',
          409,
        );
      }

      const remainingQuantity = bottleLot.currentBottleCount - input.amount;
      if (remainingQuantity <= 0) {
        await LossRepository.updateBottleLotStatus(tx, bottleLot.id, 'ARCHIVE');
      }

      const event = await LossRepository.createBottleEvent(tx, {
        eventType: 'CASSE',
        operatorUserId: operator.id,
        eventDatetime,
        comment: input.note,
      });

      await LossRepository.createBottleEventLink(tx, {
        eventId: event.id,
        bottleLotId: bottleLot.id,
        roleInEvent: 'SOURCE',
        bottleCount: input.amount,
      });

      await LossRepository.createIdempotencyRecord(tx, input.idempotencyKey, actor.email);
      await LossRepository.createAuditLog(tx, {
        action: 'BOTTLE_LOSS_DECLARATION',
        details: `${input.amount} bouteilles déclarées perdues sur le lot ${bottleLot.businessCode} par ${actor.email}.`,
        userId: actor.email,
      });

      return {
        entityType: input.entityType,
        entityId: bottleLot.id,
        remainingQuantity,
      };
    });
  }
}
