import { Prisma } from '@prisma/client';
import { BusinessLogicError } from '@/lib/errors';
import { CreateTirageInput } from '@/server/modules/tirage/tirage.schemas';
import { TirageRepository } from '@/server/modules/tirage/tirage.repository';
import { RequestActor } from '@/server/shared/request-context';

interface TirageResult {
  bottleLotId: number;
  bottleLotCode: string;
  remainingVolume: number;
}

const toDecimal = (value: number) => new Prisma.Decimal(value.toFixed(3));
const toNumber = (value: Prisma.Decimal | number) => Number(value);

export class TirageModuleService {
  static async execute(input: CreateTirageInput, actor: RequestActor): Promise<TirageResult> {
    return TirageRepository.withTransaction(async (tx) => {
      const existingRequest = await TirageRepository.findIdempotencyRecord(tx, input.idempotencyKey);
      if (existingRequest) {
        throw new BusinessLogicError('Cette requête de tirage a déjà été traitée.', 409);
      }

      const operator = await TirageRepository.findUserByEmail(tx, actor.email);
      if (!operator) {
        throw new BusinessLogicError('Utilisateur opérateur introuvable.', 401);
      }

      const sourceLot = await TirageRepository.findSourceLot(tx, input.lotId);
      if (!sourceLot) {
        throw new BusinessLogicError('Lot source introuvable.', 404);
      }

      if (['ARCHIVE', 'TIRE'].includes(sourceLot.status)) {
        throw new BusinessLogicError(`Le lot ${sourceLot.businessCode} n'est plus disponible pour un tirage.`, 409);
      }

      const sourceVolume = toNumber(sourceLot.currentVolume);
      if (sourceVolume < input.volume) {
        throw new BusinessLogicError(
          `Volume insuffisant dans le lot source. Disponible: ${sourceVolume} hL, demandé: ${input.volume} hL.`,
          409,
        );
      }

      const decrementResult = await TirageRepository.decrementSourceLot(
        tx,
        sourceLot.id,
        toDecimal(input.volume),
      );
      if (decrementResult.count !== 1) {
        throw new BusinessLogicError(
          'Le volume source a changé pendant l\'opération. Rechargez les données puis réessayez.',
          409,
        );
      }

      const remainingVolume = Number((sourceVolume - input.volume).toFixed(3));
      if (remainingVolume <= 0) {
        await TirageRepository.updateSourceLotStatus(tx, sourceLot.id, 'TIRE');
      }

      const tirageDate = new Date(input.tirageDate);
      const tirageYear = tirageDate.getUTCFullYear();
      const typeCode = input.isTranquille ? 'MISE' : 'TIRAGE';
      const targetStatus = input.isTranquille ? 'EN_CAVE' : 'SUR_LATTES';
      const nextSequence = await TirageRepository.countBottleLotsByTypeAndYear(tx, typeCode, tirageYear);
      const code = `${typeCode}-${tirageYear}-${String(nextSequence + 1).padStart(4, '0')}`;

      const bottleLot = await TirageRepository.createBottleLot(tx, {
        technicalCode: `${code}-${input.idempotencyKey.slice(0, 8)}`,
        businessCode: code,
        type: typeCode,
        sourceLotId: sourceLot.id,
        formatCode: input.format,
        initialBottleCount: input.count,
        currentBottleCount: input.count,
        status: targetStatus,
        tirageDate,
        locationZone: input.zone ?? null,
      });

      const lotEvent = await TirageRepository.createLotEvent(tx, {
        operatorUserId: operator.id,
        eventType: typeCode,
        eventDatetime: tirageDate,
        comment: [
          `${typeCode}: ${input.count} bouteilles au format ${input.format}.`,
          input.note ?? null,
        ]
          .filter(Boolean)
          .join(' '),
      });

      await TirageRepository.createLotEventLink(tx, {
        eventId: lotEvent.id,
        lotId: sourceLot.id,
        roleInEvent: 'SOURCE',
        volumeChange: toDecimal(input.volume),
      });

      const bottleEvent = await TirageRepository.createBottleEvent(tx, {
        operatorUserId: operator.id,
        eventType: input.isTranquille ? 'CREATION_MISE' : 'CREATION_TIRAGE',
        eventDatetime: tirageDate,
        comment: input.note ?? (input.isTranquille ? 'Mise en bouteille vin tranquille' : 'Tirage initial'),
      });

      await TirageRepository.createBottleEventLink(tx, {
        eventId: bottleEvent.id,
        bottleLotId: bottleLot.id,
        roleInEvent: 'CIBLE',
        bottleCount: input.count,
      });

      await TirageRepository.createIdempotencyRecord(tx, input.idempotencyKey, actor.email);
      await TirageRepository.createAuditLog(tx, {
        action: 'TIRAGE_EXECUTED',
        details: `Tirage ${bottleLot.businessCode} créé à partir du lot ${sourceLot.businessCode} par ${actor.email}.`,
        userId: actor.email,
      });

      return {
        bottleLotId: bottleLot.id,
        bottleLotCode: bottleLot.businessCode,
        remainingVolume,
      };
    });
  }
}
