import { Prisma } from '@prisma/client';
import { BusinessLogicError } from '@/lib/errors';
import { CreateLotInput, UpdateLotVolumeInput } from '@/server/modules/lots/lot.schemas';
import { LotRepository } from '@/server/modules/lots/lot.repository';
import { RequestActor } from '@/server/shared/request-context';

const toDecimal = (value: number) => new Prisma.Decimal(value.toFixed(3));
const toNumber = (value: Prisma.Decimal | number) => Number(value);

const parseYear = (value: CreateLotInput['millesime']) => {
  const year = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (Number.isNaN(year)) {
    throw new BusinessLogicError('Millésime invalide.', 400);
  }

  return year;
};

export class LotModuleService {
  static async list() {
    return LotRepository.listLots();
  }

  static async create(input: CreateLotInput, actor: RequestActor) {
    return LotRepository.withTransaction(async (tx) => {
      const existingRequest = await LotRepository.findIdempotencyRecord(tx, input.idempotencyKey);
      if (existingRequest) {
        throw new BusinessLogicError('Cette création de lot a déjà été traitée.', 409);
      }

      const operator = await LotRepository.findUserByEmail(tx, actor.email);
      if (!operator) {
        throw new BusinessLogicError('Utilisateur opérateur introuvable.', 401);
      }

      const container = await LotRepository.findContainerWithLots(tx, input.containerId);
      if (!container) {
        throw new BusinessLogicError('Cuve introuvable.', 404);
      }

      const occupiedVolume = container.currentLots.reduce((sum, lot) => sum + toNumber(lot.currentVolume), 0);
      const capacity = toNumber(container.capacityValue);
      const nextVolume = occupiedVolume + input.volume;
      if (occupiedVolume > 0.0001) {
        throw new BusinessLogicError(
          `La cuve ${container.displayName} n'est pas vide (${occupiedVolume} hL présents).`,
          409,
        );
      }
      if (nextVolume > capacity) {
        throw new BusinessLogicError(
          `Capacité dépassée pour ${container.displayName}. ${nextVolume} hL > ${capacity} hL.`,
          409,
        );
      }

      const year = parseYear(input.millesime);
      const technicalSuffix = Date.now().toString().slice(-6);
      const lot = await LotRepository.createLot(tx, {
        technicalCode: `${input.code}-${technicalSuffix}`,
        businessCode: input.code,
        year,
        mainGrapeCode: input.cepage,
        placeCode: input.lieu?.trim() || null,
        sequenceNumber: 1,
        currentVolume: toDecimal(input.volume),
        currentContainerId: input.containerId,
        status: input.status,
        qualiteLot: input.qualiteLot?.trim() || null,
        notes: input.notes?.trim() || null,
      });

      await LotRepository.updateContainerStatus(tx, input.containerId, 'PLEIN');

      const event = await LotRepository.createLotEvent(tx, {
        eventType: 'CREATION',
        operatorUserId: operator.id,
        comment: input.notes?.trim() || 'Création initiale du lot',
        metadata: {
          operation: 'CREATION',
          lotId: lot.id,
          lotCode: lot.businessCode,
          containerId: input.containerId,
          status: lot.status,
          volumeHl: input.volume,
          originType: input.originType ?? null,
          originLabel: input.originLabel?.trim() || null,
          note: input.notes?.trim() || null,
          idempotencyKey: input.idempotencyKey,
        },
      });

      await LotRepository.createLotEventLink(tx, {
        eventId: event.id,
        lotId: lot.id,
        roleInEvent: 'CIBLE',
        volumeChange: toDecimal(input.volume),
      });
      await LotRepository.createContainerEventLink(tx, {
        eventId: event.id,
        containerId: input.containerId,
        roleInEvent: 'CIBLE',
      });

      await LotRepository.createIdempotencyRecord(tx, input.idempotencyKey, 'CREATE_LOT', actor.email);
      await LotRepository.createAuditLog(tx, {
        action: 'LOT_CREATED',
        details: `Lot ${lot.businessCode} créé dans ${container.displayName} avec ${input.volume} hL par ${actor.email}.`,
        userId: actor.email,
      });

      return {
        eventId: event.id,
        lot,
      };
    });
  }

  static async updateVolume(input: UpdateLotVolumeInput, actor: RequestActor) {
    return LotRepository.withTransaction(async (tx) => {
      const existingRequest = await LotRepository.findIdempotencyRecord(tx, input.idempotencyKey);
      if (existingRequest) {
        throw new BusinessLogicError('Cette correction de volume a déjà été traitée.', 409);
      }

      const operator = await LotRepository.findUserByEmail(tx, actor.email);
      if (!operator) {
        throw new BusinessLogicError('Utilisateur opérateur introuvable.', 401);
      }

      const lot = await LotRepository.findLotById(tx, input.lotId);
      if (!lot) {
        throw new BusinessLogicError('Lot introuvable.', 404);
      }

      const diff = Number((input.newVolume - toNumber(lot.currentVolume)).toFixed(3));
      if (diff === 0) {
        throw new BusinessLogicError('Aucune correction de volume à enregistrer.', 400);
      }

      const updatedLot = await LotRepository.updateLotVolume(tx, lot.id, toDecimal(input.newVolume));
      const eventType = diff > 0 ? 'CORRECTION_HAUSSE' : 'CORRECTION_BAISSE';
      const previousVolume = toNumber(lot.currentVolume);
      const note = input.note?.trim() || null;
      const event = await LotRepository.createLotEvent(tx, {
        eventType,
        operatorUserId: operator.id,
        comment: [
          `Ancien volume: ${previousVolume} hL.`,
          `Nouveau volume: ${input.newVolume} hL.`,
          `Delta: ${diff > 0 ? '+' : ''}${diff} hL.`,
          note ? `Motif: ${note}` : null,
        ]
          .filter(Boolean)
          .join(' '),
        metadata: {
          operation: 'CORRECTION_VOLUME',
          eventType,
          lotId: updatedLot.id,
          containerId: updatedLot.currentContainerId,
          previousVolumeHl: previousVolume,
          newVolumeHl: input.newVolume,
          deltaHl: diff,
          reason: note,
          note,
          idempotencyKey: input.idempotencyKey,
        },
      });

      await LotRepository.createLotEventLink(tx, {
        eventId: event.id,
        lotId: updatedLot.id,
        roleInEvent: 'CIBLE',
        volumeChange: toDecimal(Math.abs(diff)),
      });

      if (updatedLot.currentContainerId) {
        await LotRepository.createContainerEventLink(tx, {
          eventId: event.id,
          containerId: updatedLot.currentContainerId,
          roleInEvent: 'CIBLE',
        });
      }

      await LotRepository.createIdempotencyRecord(tx, input.idempotencyKey, 'UPDATE_VOLUME', actor.email);
      await LotRepository.createAuditLog(tx, {
        action: 'LOT_VOLUME_CORRECTED',
        details: `Lot ${lot.businessCode} corrigé de ${diff} hL par ${actor.email}.`,
        userId: actor.email,
      });

      return {
        eventId: event.id,
        lotId: updatedLot.id,
        previousVolume: toNumber(lot.currentVolume),
        newVolume: input.newVolume,
        delta: diff,
      };
    });
  }
}
