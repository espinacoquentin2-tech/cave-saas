import { Prisma } from '@prisma/client';
import { BusinessLogicError } from '@/lib/errors';
import { CreateTransferInput } from '@/server/modules/transfers/transfer.schemas';
import {
  TransferRepository,
  TransferSourceSnapshot,
} from '@/server/modules/transfers/transfer.repository';
import { RequestActor } from '@/server/shared/request-context';

interface TransferResult {
  eventId: number;
  sourceLotId: number;
  createdLotIds: number[];
  remainingVolume: number;
}

const toDecimal = (value: number) => new Prisma.Decimal(value.toFixed(3));
const toNumber = (value: Prisma.Decimal | number) => Number(value);

const assertSourceConsistency = (
  sourceLot: TransferSourceSnapshot,
  input: CreateTransferInput,
) => {
  if (sourceLot.currentContainerId !== input.fromId) {
    throw new BusinessLogicError('Le lot source n\'est pas rattaché à la cuve source demandée.', 409);
  }

  const sourceVolume = toNumber(sourceLot.currentVolume);
  if (sourceVolume < input.volume) {
    throw new BusinessLogicError(
      `Volume insuffisant dans le lot source. Disponible: ${sourceVolume} hL, demandé: ${input.volume} hL.`,
      409,
    );
  }
};

const normalizeRemainderStatus = (status: string | null | undefined) => {
  if (!status) {
    return null;
  }

  return status === 'BOURBES' ? 'BOURBES' : 'LIES';
};

export class TransferService {
  static async execute(input: CreateTransferInput, actor: RequestActor): Promise<TransferResult> {
    return TransferRepository.withTransaction(async (tx) => {
      const existingRequest = await TransferRepository.findIdempotencyRecord(tx, input.idempotencyKey);
      if (existingRequest) {
        throw new BusinessLogicError('Cette requête de transfert a déjà été traitée.', 409);
      }

      const operator = await TransferRepository.findUserByEmail(tx, actor.email);
      if (!operator) {
        throw new BusinessLogicError('Utilisateur opérateur introuvable.', 401);
      }

      const sourceLot = await TransferRepository.findSourceLot(tx, input.lotId);
      if (!sourceLot || !sourceLot.currentContainer) {
        throw new BusinessLogicError('Lot source ou cuve source introuvable.', 404);
      }

      assertSourceConsistency(sourceLot, input);

      const remainderStatus = normalizeRemainderStatus(input.remainderType);
      const targetContainerIds = [
        ...new Set([
          ...input.destinations.map((destination) => destination.toId),
          ...(input.bourbesDestId ? [input.bourbesDestId] : []),
        ]),
      ];
      const targetContainers = await TransferRepository.findTargetContainers(tx, targetContainerIds);
      const targetContainersById = new Map(targetContainers.map((container) => [container.id, container]));

      if (targetContainers.length !== targetContainerIds.length) {
        throw new BusinessLogicError('Au moins une cuve cible est introuvable.', 404);
      }

      const reservedVolumes = new Map<number, number>();
      for (const destination of input.destinations) {
        reservedVolumes.set(
          destination.toId,
          (reservedVolumes.get(destination.toId) ?? 0) + destination.volume,
        );
      }

      const remainingVolume = toNumber(sourceLot.currentVolume) - input.volume;
      if (remainderStatus && input.bourbesDestId && remainingVolume > 0) {
        reservedVolumes.set(
          input.bourbesDestId,
          (reservedVolumes.get(input.bourbesDestId) ?? 0) + remainingVolume,
        );
      }

      for (const [containerId, reservedVolume] of reservedVolumes.entries()) {
        const targetContainer = targetContainersById.get(containerId);
        if (!targetContainer) {
          throw new BusinessLogicError(`Cuve cible ${containerId} introuvable.`, 404);
        }

        const occupiedVolume = targetContainer.currentLots.reduce(
          (sum, lot) => sum + toNumber(lot.currentVolume),
          0,
        );
        const nextVolume = occupiedVolume + reservedVolume;
        const capacity = toNumber(targetContainer.capacityValue);

        if (nextVolume > capacity) {
          throw new BusinessLogicError(
            `Capacité dépassée pour ${targetContainer.displayName}. ${nextVolume} hL > ${capacity} hL.`,
            409,
          );
        }
      }

      const sourceDecrement = await TransferRepository.decrementSourceLot(
        tx,
        sourceLot.id,
        toDecimal(input.volume),
      );

      if (sourceDecrement.count !== 1) {
        throw new BusinessLogicError(
          'Le volume source a changé pendant l\'opération. Recharger les données puis réessayer.',
          409,
        );
      }

      const createdLotIds: number[] = [];

      const event = await TransferRepository.createTransferEvent(tx, {
        operatorUserId: operator.id,
        eventDatetime: new Date(input.date),
        comment: [
          `Transfert de ${input.volume} hL depuis ${sourceLot.currentContainer.displayName}.`,
          input.note?.trim() || null,
        ]
          .filter(Boolean)
          .join(' '),
      });

      await TransferRepository.createLotEventLink(tx, {
        eventId: event.id,
        lotId: sourceLot.id,
        roleInEvent: 'SOURCE',
        volumeChange: toDecimal(input.volume),
      });
      await TransferRepository.createContainerEventLink(tx, {
        eventId: event.id,
        containerId: sourceLot.currentContainer.id,
        roleInEvent: 'SOURCE',
      });

      if (remainingVolume <= 0) {
        await TransferRepository.updateSourceLotStatus(tx, sourceLot.id, 'ARCHIVE', null);
        await TransferRepository.updateContainerStatus(tx, sourceLot.currentContainer.id, 'NETTOYAGE');
      } else if (remainderStatus) {
        await TransferRepository.updateSourceLotStatus(tx, sourceLot.id, 'ARCHIVE', null);
        await TransferRepository.updateContainerStatus(tx, sourceLot.currentContainer.id, 'NETTOYAGE');

        const remainderLot = await TransferRepository.createChildLot(tx, {
          technicalCode: `${sourceLot.technicalCode}-${remainderStatus.slice(0, 2)}-${event.id}`,
          businessCode: `${sourceLot.businessCode}-${remainderStatus.slice(0, 2)}-${event.id}`,
          year: sourceLot.year,
          mainGrapeCode: sourceLot.mainGrapeCode,
          sequenceNumber: sourceLot.sequenceNumber,
          currentVolume: toDecimal(remainingVolume),
          currentContainerId: input.bourbesDestId!,
          status: remainderStatus,
          notes: `Reliquat ${remainderStatus.toLowerCase()} généré par transfert #${event.id}.`,
        });

        createdLotIds.push(remainderLot.id);

        await TransferRepository.updateContainerStatus(tx, input.bourbesDestId!, 'PLEIN');
        await TransferRepository.createLotEventLink(tx, {
          eventId: event.id,
          lotId: remainderLot.id,
          roleInEvent: 'RELIQUAT',
          volumeChange: toDecimal(remainingVolume),
        });
        await TransferRepository.createContainerEventLink(tx, {
          eventId: event.id,
          containerId: input.bourbesDestId!,
          roleInEvent: 'RELIQUAT',
        });
      }

      for (const [index, destination] of input.destinations.entries()) {
        const targetStatus =
          sourceLot.currentContainer?.type === 'CUVE_DEBOURBAGE' && sourceLot.status === 'MOUT_NON_DEBOURBE'
            ? 'MOUT_DEBOURBE'
            : sourceLot.status;

        const targetLot = await TransferRepository.createChildLot(tx, {
          technicalCode: `${sourceLot.technicalCode}-TR-${event.id}-${index + 1}`,
          businessCode: `${sourceLot.businessCode}-TR-${event.id}-${index + 1}`,
          year: sourceLot.year,
          mainGrapeCode: sourceLot.mainGrapeCode,
          sequenceNumber: sourceLot.sequenceNumber,
          currentVolume: toDecimal(destination.volume),
          currentContainerId: destination.toId,
          status: targetStatus,
          qualiteLot: input.qualiteLot?.trim() || null,
          notes: input.notes?.trim() || `Lot issu du transfert #${event.id}.`,
        });

        createdLotIds.push(targetLot.id);

        await TransferRepository.updateContainerStatus(tx, destination.toId, 'PLEIN');
        await TransferRepository.createLotEventLink(tx, {
          eventId: event.id,
          lotId: targetLot.id,
          roleInEvent: 'CIBLE',
          volumeChange: toDecimal(destination.volume),
        });
        await TransferRepository.createContainerEventLink(tx, {
          eventId: event.id,
          containerId: destination.toId,
          roleInEvent: 'CIBLE',
        });
      }

      await TransferRepository.createIdempotencyRecord(tx, input.idempotencyKey, actor.email);
      await TransferRepository.createAuditLog(tx, {
        action: 'TRANSFER_EXECUTED',
        details: `Transfert ${event.id} exécuté par ${actor.email} sur le lot ${sourceLot.businessCode}.`,
        userId: actor.email,
      });

      return {
        eventId: event.id,
        sourceLotId: sourceLot.id,
        createdLotIds,
        remainingVolume: Number(remainingVolume.toFixed(3)),
      };
    });
  }
}
