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
const roundVolume = (value: number) => Number(value.toFixed(3));

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

      const sourceLot = await TransferRepository.findSourceLot(tx, input.lotId, actor.organizationId);
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
      const targetContainers = await TransferRepository.findTargetContainers(tx, targetContainerIds, actor.organizationId);
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

      const remainderVolume = input.remainderVolume ?? 0;
      const remainingVolume = toNumber(sourceLot.currentVolume) - input.volume;
      if (remainderStatus && input.bourbesDestId && remainderVolume > 0) {
        reservedVolumes.set(
          input.bourbesDestId,
          (reservedVolumes.get(input.bourbesDestId) ?? 0) + remainderVolume,
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
        actor.organizationId,
        toDecimal(input.volume),
      );

      if (sourceDecrement.count !== 1) {
        throw new BusinessLogicError(
          'Le volume source a changé pendant l\'opération. Recharger les données puis réessayer.',
          409,
        );
      }

      const createdLotIds: number[] = [];
      const transferredVolume = input.destinations.reduce(
        (sum, destination) => sum + destination.volume,
        0,
      );
      const transferDestinations: Array<{
        lotId: number | null;
        containerId: number;
        volumeHl: number;
        status: string;
      }> = input.destinations.map((destination) => ({
        lotId: null,
        containerId: destination.toId,
        volumeHl: roundVolume(destination.volume),
        status:
          sourceLot.currentContainer?.type === 'CUVE_DEBOURBAGE' && sourceLot.status === 'MOUT_NON_DEBOURBE'
            ? 'MOUT_DEBOURBE'
            : sourceLot.status,
      }));
      const note = input.note?.trim() || null;
      const transferMetadata = () => ({
        operation: 'TRANSFERT',
        sourceLotId: sourceLot.id,
        sourceContainerId: sourceLot.currentContainer?.id ?? input.fromId,
        requestedVolumeHl: roundVolume(input.volume),
        transferredVolumeHl: roundVolume(transferredVolume),
        remainderVolumeHl: roundVolume(remainderVolume),
        remainingSourceVolumeHl: roundVolume(Math.max(remainingVolume, 0)),
        remainderStatus,
        destinations: transferDestinations,
        createdLotIds,
        note,
        idempotencyKey: input.idempotencyKey,
      });

      const event = await TransferRepository.createTransferEvent(tx, {
        operatorUserId: operator.id,
        eventDatetime: new Date(input.date),
        organizationId: actor.organizationId,
        comment: [
          `Transfert de ${input.volume} hL depuis ${sourceLot.currentContainer.displayName}.`,
          note,
        ]
          .filter(Boolean)
          .join(' '),
        metadata: transferMetadata(),
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
        await TransferRepository.updateSourceLotStatus(tx, sourceLot.id, actor.organizationId, 'ARCHIVE', null);
        await TransferRepository.updateContainerStatus(tx, sourceLot.currentContainer.id, actor.organizationId, 'NETTOYAGE');
      }

      if (remainderStatus && input.bourbesDestId && remainderVolume > 0) {
        const remainderLot = await TransferRepository.createChildLot(tx, {
          technicalCode: `${sourceLot.technicalCode}-${remainderStatus.slice(0, 2)}-${event.id}`,
          businessCode: `${sourceLot.businessCode}-${remainderStatus.slice(0, 2)}-${event.id}`,
          year: sourceLot.year,
          mainGrapeCode: sourceLot.mainGrapeCode,
          sequenceNumber: sourceLot.sequenceNumber,
          currentVolume: toDecimal(remainderVolume),
          currentContainerId: input.bourbesDestId!,
          status: remainderStatus,
          organizationId: actor.organizationId,
          notes: `Reliquat ${remainderStatus.toLowerCase()} généré par transfert #${event.id}.`,
        });

        createdLotIds.push(remainderLot.id);

        await TransferRepository.updateContainerStatus(tx, input.bourbesDestId!, actor.organizationId, 'PLEIN');
        await TransferRepository.createLotEventLink(tx, {
          eventId: event.id,
          lotId: remainderLot.id,
          roleInEvent: 'RELIQUAT',
          volumeChange: toDecimal(remainderVolume),
        });
        await TransferRepository.createContainerEventLink(tx, {
          eventId: event.id,
          containerId: input.bourbesDestId!,
          roleInEvent: 'RELIQUAT',
        });
      }

      for (const [index, destination] of input.destinations.entries()) {
        const targetStatus = transferDestinations[index].status;

        const targetLot = await TransferRepository.createChildLot(tx, {
          technicalCode: `${sourceLot.technicalCode}-TR-${event.id}-${index + 1}`,
          businessCode: `${sourceLot.businessCode}-TR-${event.id}-${index + 1}`,
          year: sourceLot.year,
          mainGrapeCode: sourceLot.mainGrapeCode,
          sequenceNumber: sourceLot.sequenceNumber,
          currentVolume: toDecimal(destination.volume),
          currentContainerId: destination.toId,
          status: targetStatus,
          organizationId: actor.organizationId,
          qualiteLot: input.qualiteLot?.trim() || null,
          notes: input.notes?.trim() || `Lot issu du transfert #${event.id}.`,
        });

        createdLotIds.push(targetLot.id);
        transferDestinations[index].lotId = targetLot.id;

        await TransferRepository.updateContainerStatus(tx, destination.toId, actor.organizationId, 'PLEIN');
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

      await TransferRepository.updateTransferEventMetadata(tx, event.id, transferMetadata());

      await TransferRepository.createIdempotencyRecord(tx, input.idempotencyKey, actor.email);
      await TransferRepository.createAuditLog(tx, {
        action: 'TRANSFER_EXECUTED',
        details: `Transfert ${event.id} exécuté par ${actor.email} sur le lot ${sourceLot.businessCode}.`,
        userId: actor.email,
        organizationId: actor.organizationId,
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
