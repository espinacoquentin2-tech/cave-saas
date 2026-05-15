import { Prisma } from '@prisma/client';
import { BusinessLogicError } from '@/lib/errors';
import { CreateVracShipmentInput } from '@/server/modules/expeditions/vrac.schemas';
import { prisma } from '@/server/shared/prisma';

type Tx = Prisma.TransactionClient;

const ELIGIBLE_LOT_STATUSES = new Set(['VIN_DE_BASE', 'ASSEMBLAGE', 'ASSEMBLE', 'RESERVE']);
const REFUSED_LOT_STATUSES = new Set([
  'MOUT_NON_DEBOURBE',
  'MOUT_DEBOURBE',
  'FERMENTATION_ALCOOLIQUE',
  'FERMENTATION_MALOLACTIQUE',
  'FA_ET_FML',
  'MACERATION',
  'VIN_ROUGE',
  'BOURBES',
  'LIES',
  'REBECHES',
  'TIRE',
  'MIS_EN_BOUTEILLE',
  'ARCHIVE',
]);
const VRAC_SHIPMENT_CONTAINER_TYPES = new Set(['CITERNE', 'COMPARTIMENT']);
const EMPTY_VOLUME_EPSILON = 0.0001;

const roundVolume = (value: number) => Math.round(value * 1000) / 1000;

const isConcurrentVracShipmentConflict = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2034' || error.code === 'P2002';
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('write conflict') ||
    message.includes('deadlock') ||
    message.includes('could not serialize access') ||
    message.includes('transaction failed due to a write conflict')
  );
};

export class VracExpeditionService {
  static readonly eligibleLotStatuses = Array.from(ELIGIBLE_LOT_STATUSES);
  static readonly refusedLotStatuses = Array.from(REFUSED_LOT_STATUSES);

  private static async getUserId(tx: Tx, email: string) {
    const user = await tx.user.findFirst({ where: { email } });
    if (!user) {
      throw new BusinessLogicError('Utilisateur non autorise.', 401);
    }

    return user.id;
  }

  static async create(input: CreateVracShipmentInput, userEmail: string) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          if (input.idempotencyKey) {
            const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: input.idempotencyKey } });
            if (existingTx) {
              throw new BusinessLogicError('Cette expedition vrac a deja ete traitee.', 409);
            }
          }

          const [lot, container] = await Promise.all([
            tx.lot.findUnique({ where: { id: input.lotId } }),
            tx.container.findUnique({ where: { id: input.containerId } }),
          ]);

          if (!lot) {
            throw new BusinessLogicError('Lot vrac introuvable.', 404);
          }
          if (!container) {
            throw new BusinessLogicError('Contenant introuvable.', 404);
          }

          const lotStatus = String(lot.status || '').toUpperCase();
          const availableVolume = Number(lot.currentVolume);

          if (!Number.isFinite(availableVolume) || availableVolume <= 0) {
            throw new BusinessLogicError(`Le lot ${lot.businessCode} ne contient plus de volume disponible.`, 409);
          }

          if (input.volumeHl > availableVolume) {
            throw new BusinessLogicError(
              `Volume insuffisant sur ${lot.businessCode}. Disponible: ${roundVolume(availableVolume)} hL, requis: ${input.volumeHl} hL.`,
              409,
            );
          }

          if (lot.currentContainerId !== container.id) {
            throw new BusinessLogicError(`Le lot ${lot.businessCode} n'est pas dans le contenant fourni.`, 409);
          }

          if (!VRAC_SHIPMENT_CONTAINER_TYPES.has(container.type)) {
            throw new BusinessLogicError(
              `Le contenant ${container.displayName} est de type ${container.type}. Types autorises: CITERNE, COMPARTIMENT.`,
              409,
            );
          }

          if (!ELIGIBLE_LOT_STATUSES.has(lotStatus)) {
            const reason = REFUSED_LOT_STATUSES.has(lotStatus)
              ? `statut refuse: ${lot.status}`
              : `statut non autorise: ${lot.status}`;
            throw new BusinessLogicError(
              `Le lot ${lot.businessCode} ne peut pas etre expedie en vrac (${reason}). Statuts autorises: ${VracExpeditionService.eligibleLotStatuses.join(', ')}.`,
              409,
            );
          }

          const operatorId = await this.getUserId(tx, userEmail);
          const shipmentDate = new Date();
          const shipmentVolume = new Prisma.Decimal(input.volumeHl);

          const decrementResult = await tx.lot.updateMany({
            where: {
              id: lot.id,
              currentContainerId: container.id,
              status: { in: VracExpeditionService.eligibleLotStatuses },
              currentVolume: { gte: shipmentVolume },
            },
            data: {
              currentVolume: {
                decrement: shipmentVolume,
              },
            },
          });

          if (decrementResult.count !== 1) {
            throw new BusinessLogicError(
              "Le volume du lot a change pendant l'expedition. Rechargez les donnees puis reessayez.",
              409,
            );
          }

          const remainingVolume = roundVolume(availableVolume - input.volumeHl);
          if (remainingVolume <= EMPTY_VOLUME_EPSILON) {
            await tx.lot.update({
              where: { id: lot.id },
              data: {
                currentVolume: new Prisma.Decimal(0),
                status: 'ARCHIVE',
              },
            });
          }

          const otherActiveLotsInContainer = await tx.lot.count({
            where: {
              currentContainerId: container.id,
              id: { not: lot.id },
              status: { not: 'ARCHIVE' },
              currentVolume: { gt: new Prisma.Decimal(0) },
            },
          });
          if (remainingVolume <= EMPTY_VOLUME_EPSILON && otherActiveLotsInContainer === 0) {
            await tx.container.update({
              where: { id: container.id },
              data: { status: 'VIDE' },
            });
          }

          const comment = [
            `Expedition vrac de ${input.volumeHl} hL du lot ${lot.businessCode} vers ${input.client} / ${input.destination}, mode ${input.mode}.`,
            `LotId: ${lot.id}.`,
            `ContainerId: ${container.id}.`,
            `Utilisateur: ${userEmail}.`,
            input.note ? `Note: ${input.note}` : null,
          ]
            .filter(Boolean)
            .join(' ');

          const lotEvent = await tx.lotEvent.create({
            data: {
              eventType: 'EXPEDITION_VRAC',
              eventDatetime: shipmentDate,
              operatorUserId: operatorId,
              comment,
            },
          });
          await tx.lotEventLot.create({
            data: {
              eventId: lotEvent.id,
              lotId: lot.id,
              roleInEvent: 'SOURCE',
              volumeChange: shipmentVolume,
              unit: 'hL',
            },
          });
          await tx.lotEventContainer.create({
            data: {
              eventId: lotEvent.id,
              containerId: container.id,
              roleInEvent: 'SOURCE',
            },
          });

          if (input.idempotencyKey) {
            await tx.idempotencyRecord.create({
              data: {
                key: input.idempotencyKey,
                action: 'EXPEDITION_VRAC',
                userId: userEmail,
              },
            });
          }

          await tx.auditLog.create({
            data: {
              action: 'BULK_SHIPMENT_EXECUTED',
              details: `Expedition vrac du lot ${lot.businessCode} depuis ${container.displayName}: ${input.volumeHl} hL vers ${input.client} / ${input.destination}, mode ${input.mode}, reste ${Math.max(0, remainingVolume)} hL.`,
              userId: userEmail,
            },
          });

          return {
            status: 'SUCCESS',
            lotEventId: lotEvent.id,
            lotId: lot.id,
            lotCode: lot.businessCode,
            containerId: container.id,
            shippedVolumeHl: input.volumeHl,
            remainingVolumeHl: Math.max(0, remainingVolume),
            lotStatus: remainingVolume <= EMPTY_VOLUME_EPSILON ? 'ARCHIVE' : lot.status,
            containerStatus: remainingVolume <= EMPTY_VOLUME_EPSILON && otherActiveLotsInContainer === 0 ? 'VIDE' : container.status,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isConcurrentVracShipmentConflict(error)) {
        throw new BusinessLogicError(
          "Un autre operateur a modifie le lot pendant l'expedition vrac. Rechargez puis reessayez.",
          409,
        );
      }

      throw error;
    }
  }
}
