import { Prisma } from '@prisma/client';
import { BusinessLogicError } from '@/lib/errors';
import { DecuvageInput } from '@/server/modules/decuvage/decuvage.schemas';
import { DecuvageRepository } from '@/server/modules/decuvage/decuvage.repository';
import { RequestActor } from '@/server/shared/request-context';

const toDecimal = (value: number) => new Prisma.Decimal(value.toFixed(3));
const toNumber = (value: Prisma.Decimal | number) => Number(value);

export class DecuvageService {
  static async execute(input: DecuvageInput, actor: RequestActor) {
    return DecuvageRepository.withTransaction(async (tx) => {
      const existingRequest = await DecuvageRepository.findIdempotencyRecord(tx, input.idempotencyKey);
      if (existingRequest) {
        throw new BusinessLogicError('Cette opération de décuvage a déjà été traitée.', 409);
      }

      const operator = await DecuvageRepository.findUserByEmail(tx, actor.email);
      if (!operator) {
        throw new BusinessLogicError('Utilisateur opérateur introuvable.', 401);
      }

      const sourceLot = await DecuvageRepository.findSourceLot(tx, input.sourceLotId);
      if (!sourceLot || !sourceLot.currentContainer) {
        throw new BusinessLogicError('Lot source ou cuve source introuvable.', 404);
      }

      if (sourceLot.currentContainer.id !== input.sourceContainerId) {
        throw new BusinessLogicError('Le lot source n\'est pas rattaché à la cuve source demandée.', 409);
      }

      const totalDecuvage = Number((input.volGoutte + input.volPresse).toFixed(3));
      const sourceVolume = toNumber(sourceLot.currentVolume);
      if (sourceVolume < totalDecuvage) {
        throw new BusinessLogicError(
          `Volume insuffisant. Disponible: ${sourceVolume} hL, demandé: ${totalDecuvage} hL.`,
          409,
        );
      }

      const targetContainerIds = [input.cuveGoutteId, input.cuvePresseId].filter(
        (value): value is number => Boolean(value),
      );
      const targetContainers = await DecuvageRepository.findContainers(tx, [...new Set(targetContainerIds)]);
      const targetContainersById = new Map(targetContainers.map((container) => [container.id, container]));

      if (targetContainers.length !== new Set(targetContainerIds).size) {
        throw new BusinessLogicError('Au moins une cuve cible est introuvable.', 404);
      }

      for (const [containerId, volume] of [
        [input.cuveGoutteId, input.volGoutte],
        [input.cuvePresseId, input.volPresse],
      ] as const) {
        if (!containerId || volume <= 0) {
          continue;
        }

        const container = targetContainersById.get(containerId);
        if (!container) {
          throw new BusinessLogicError(`Cuve cible ${containerId} introuvable.`, 404);
        }

        const occupiedVolume = container.currentLots.reduce((sum, lot) => sum + toNumber(lot.currentVolume), 0);
        const nextVolume = occupiedVolume + volume;
        const capacity = toNumber(container.capacityValue);
        if (nextVolume > capacity) {
          throw new BusinessLogicError(
            `Capacité dépassée pour ${container.displayName}. ${nextVolume} hL > ${capacity} hL.`,
            409,
          );
        }
      }

      const event = await DecuvageRepository.createLotEvent(tx, {
        operatorUserId: operator.id,
        comment: [
          `Décuvage de ${sourceLot.businessCode}.`,
          `Goutte: ${input.volGoutte} hL.`,
          `Presse: ${input.volPresse} hL.`,
          input.notes?.trim() || null,
        ]
          .filter(Boolean)
          .join(' '),
      });

      await DecuvageRepository.archiveSourceLot(tx, sourceLot.id);
      await DecuvageRepository.updateContainerStatus(tx, input.sourceContainerId, 'NETTOYAGE');
      await DecuvageRepository.createLotEventLink(tx, {
        eventId: event.id,
        lotId: sourceLot.id,
        roleInEvent: 'SOURCE',
        volumeChange: toDecimal(totalDecuvage),
      });
      await DecuvageRepository.createContainerEventLink(tx, {
        eventId: event.id,
        containerId: input.sourceContainerId,
        roleInEvent: 'SOURCE',
      });

      const newLots = [];
      for (const [volume, containerId, suffix, label] of [
        [input.volGoutte, input.cuveGoutteId, 'G', 'Vin de goutte'],
        [input.volPresse, input.cuvePresseId, 'P', 'Vin de presse'],
      ] as const) {
        if (volume <= 0) {
          continue;
        }

        const lot = await DecuvageRepository.createLot(tx, {
          technicalCode: `${sourceLot.technicalCode}-${suffix}-${event.id}`,
          businessCode: `${sourceLot.businessCode}-${suffix}-${event.id}`,
          year: sourceLot.year,
          mainGrapeCode: sourceLot.mainGrapeCode,
          sequenceNumber: sourceLot.sequenceNumber,
          currentVolume: toDecimal(volume),
          currentContainerId: containerId ?? null,
          status: input.finalStatus,
          notes: `${label} issu du décuvage #${event.id}.${input.notes?.trim() ? ` ${input.notes.trim()}` : ''}`,
        });

        newLots.push(lot);

        await DecuvageRepository.createLotEventLink(tx, {
          eventId: event.id,
          lotId: lot.id,
          roleInEvent: 'CIBLE',
          volumeChange: toDecimal(volume),
        });

        if (containerId) {
          await DecuvageRepository.updateContainerStatus(tx, containerId, 'PLEIN');
          await DecuvageRepository.createContainerEventLink(tx, {
            eventId: event.id,
            containerId,
            roleInEvent: 'CIBLE',
          });
        }
      }

      await DecuvageRepository.createIdempotencyRecord(tx, input.idempotencyKey, actor.email);
      await DecuvageRepository.createAuditLog(tx, {
        action: 'DECUVAGE_EXECUTED',
        details: `Décuvage du lot ${sourceLot.businessCode} (${totalDecuvage} hL) par ${actor.email}.`,
        userId: actor.email,
      });

      return {
        eventId: event.id,
        sourceLotId: sourceLot.id,
        newLots,
      };
    });
  }
}
