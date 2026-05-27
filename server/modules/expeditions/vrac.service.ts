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

          const uniqueLotIds = [...new Set(input.lines.map((line) => line.lotId))];
          const lots = await tx.lot.findMany({ where: { id: { in: uniqueLotIds } } });
          const lotsById = new Map(lots.map((lot) => [lot.id, lot]));

          if (lots.length !== uniqueLotIds.length) {
            throw new BusinessLogicError('Un ou plusieurs lots vrac sont introuvables.', 404);
          }

          const requestedByLot = new Map<number, number>();
          for (const line of input.lines) {
            requestedByLot.set(line.lotId, roundVolume((requestedByLot.get(line.lotId) || 0) + line.volumeHl));
          }

          for (const [lotId, requestedVolume] of requestedByLot.entries()) {
            const lot = lotsById.get(lotId);
            if (!lot) {
              throw new BusinessLogicError('Lot vrac introuvable.', 404);
            }

            const lotStatus = String(lot.status || '').toUpperCase();
            const availableVolume = Number(lot.currentVolume);

            if (!Number.isFinite(availableVolume) || availableVolume <= 0) {
              throw new BusinessLogicError(`Le lot ${lot.businessCode} ne contient plus de volume disponible.`, 409);
            }

            if (requestedVolume > availableVolume) {
              throw new BusinessLogicError(
                `Volume insuffisant sur ${lot.businessCode}. Disponible: ${roundVolume(availableVolume)} hL, requis: ${requestedVolume} hL.`,
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
          }

          const operatorId = await this.getUserId(tx, userEmail);
          const shipmentDate = new Date();
          const lotSnapshots = new Map<number, {
            lotCode: string;
            previousLotVolumeHl: number;
            remainingLotVolumeHl: number;
            previousLotStatus: string;
            newLotStatus: string;
          }>();

          for (const [lotId, requestedVolume] of requestedByLot.entries()) {
            const lot = lotsById.get(lotId);
            if (!lot) {
              throw new BusinessLogicError('Lot vrac introuvable.', 404);
            }

            const shipmentVolume = new Prisma.Decimal(requestedVolume);
            const availableVolume = Number(lot.currentVolume);
            const remainingVolume = roundVolume(availableVolume - requestedVolume);
            const newLotStatus = remainingVolume <= EMPTY_VOLUME_EPSILON ? 'ARCHIVE' : lot.status;

            const decrementResult = await tx.lot.updateMany({
              where: {
                id: lot.id,
                status: { in: VracExpeditionService.eligibleLotStatuses },
                currentVolume: { gte: shipmentVolume },
              },
              data: {
                currentVolume: remainingVolume <= EMPTY_VOLUME_EPSILON ? new Prisma.Decimal(0) : { decrement: shipmentVolume },
                ...(remainingVolume <= EMPTY_VOLUME_EPSILON ? { status: newLotStatus } : {}),
              },
            });

            if (decrementResult.count !== 1) {
              throw new BusinessLogicError(
                "Le volume du lot a change pendant l'expedition. Rechargez les donnees puis reessayez.",
                409,
              );
            }

            lotSnapshots.set(lot.id, {
              lotCode: lot.businessCode,
              previousLotVolumeHl: roundVolume(availableVolume),
              remainingLotVolumeHl: Math.max(0, remainingVolume),
              previousLotStatus: lot.status,
              newLotStatus,
            });
          }

          const lineRemainingByLot = new Map<number, number>(
            lots.map((lot) => [lot.id, roundVolume(Number(lot.currentVolume))]),
          );
          const metadataLines = input.lines.map((line) => {
            const lot = lotsById.get(line.lotId);
            const snapshot = lotSnapshots.get(line.lotId);
            if (!lot || !snapshot) {
              throw new BusinessLogicError('Lot vrac introuvable.', 404);
            }

            const previousLineVolume = lineRemainingByLot.get(line.lotId) ?? snapshot.previousLotVolumeHl;
            const remainingLineVolume = Math.max(0, roundVolume(previousLineVolume - line.volumeHl));
            lineRemainingByLot.set(line.lotId, remainingLineVolume);

            return {
              lotId: line.lotId,
              lotCode: snapshot.lotCode,
              volumeHl: line.volumeHl,
              compartmentLabel: line.compartmentLabel ?? null,
              mode: line.mode,
              note: line.note ?? null,
              previousLotVolumeHl: previousLineVolume,
              remainingLotVolumeHl: remainingLineVolume,
              previousLotStatus: snapshot.previousLotStatus,
              newLotStatus: snapshot.newLotStatus,
            };
          });
          const totalVolumeHl = roundVolume(input.lines.reduce((sum, line) => sum + line.volumeHl, 0));
          const destinationLabel = input.destination || 'destination non renseignee';
          const comment = [
            `Expedition vrac de ${totalVolumeHl} hL vers ${input.client} / ${destinationLabel}.`,
            `${input.lines.length} ligne(s): ${metadataLines.map((line) => `${line.lotCode} ${line.volumeHl} hL${line.compartmentLabel ? ` (${line.compartmentLabel})` : ''}`).join(', ')}.`,
            input.transporter ? `Transporteur: ${input.transporter}.` : null,
            input.truckPlate ? `Immatriculation/citerne: ${input.truckPlate}.` : null,
            input.transportReference ? `Reference transport: ${input.transportReference}.` : null,
            `Utilisateur: ${userEmail}.`,
            input.logisticsNote ? `Note: ${input.logisticsNote}` : null,
          ]
            .filter(Boolean)
            .join(' ');

          const lotEvent = await tx.lotEvent.create({
            data: {
              eventType: 'EXPEDITION_VRAC',
              eventDatetime: shipmentDate,
              operatorUserId: operatorId,
              comment,
              metadata: {
                operation: 'EXPEDITION_VRAC',
                status: 'PREPAREE',
                client: input.client,
                destination: input.destination ?? null,
                transporter: input.transporter ?? null,
                truckPlate: input.truckPlate ?? null,
                transportReference: input.transportReference ?? null,
                plannedAt: input.plannedAt ?? null,
                logisticsNote: input.logisticsNote ?? null,
                totalVolumeHl,
                lineCount: input.lines.length,
                lines: metadataLines,
                idempotencyKey: input.idempotencyKey ?? null,
              },
            },
          });
          await tx.lotEventLot.createMany({
            data: input.lines.map((line) => ({
              eventId: lotEvent.id,
              lotId: line.lotId,
              roleInEvent: 'SOURCE',
              volumeChange: new Prisma.Decimal(line.volumeHl),
              unit: 'hL',
            })),
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
              details: `Expedition vrac #${lotEvent.id}: ${totalVolumeHl} hL, ${input.lines.length} ligne(s), vers ${input.client} / ${destinationLabel}.`,
              userId: userEmail,
            },
          });

          return {
            status: 'SUCCESS',
            lotEventId: lotEvent.id,
            shippedVolumeHl: totalVolumeHl,
            lineCount: input.lines.length,
            lines: metadataLines.map((line) => ({
              lotId: line.lotId,
              lotCode: line.lotCode,
              shippedVolumeHl: line.volumeHl,
              remainingVolumeHl: line.remainingLotVolumeHl,
              lotStatus: line.newLotStatus,
            })),
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
