import { Prisma } from '@prisma/client';
import { BusinessLogicError } from '@/lib/errors';
import { ConfirmDeliveryInput } from '@/server/modules/expeditions/delivery-confirmation.schemas';
import { prisma } from '@/server/shared/prisma';

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export class DeliveryConfirmationService {
  static async confirm(input: ConfirmDeliveryInput, userEmail: string) {
    if (input.type === 'DISTILLERIE') {
      throw new BusinessLogicError(
        "La confirmation de livraison n'est pas supportée pour les envois distillerie dans le modèle actuel.",
        409,
      );
    }

    if (input.type === 'BOTTLE') {
      return prisma.$transaction(async (tx) => {
        const event = await tx.bottleEvent.findUnique({
          where: { id: input.id },
          include: { links: true },
        });

        if (!event || event.eventType !== 'EXPEDITION' || event.cancelledAt) {
          throw new BusinessLogicError('Expédition bouteilles introuvable ou annulée.', 404);
        }

        const metadata = asObject(event.metadata);
        if (metadata.deliveryStatus === 'LIVRE') {
          throw new BusinessLogicError('Cette expédition bouteilles est déjà confirmée livrée.', 409);
        }

        const deliveredAt = new Date();
        const updated = await tx.bottleEvent.update({
          where: { id: event.id },
          data: {
            metadata: {
              ...metadata,
              deliveryStatus: 'LIVRE',
              deliveredAt: deliveredAt.toISOString(),
              deliveredBy: userEmail,
            } satisfies Prisma.InputJsonObject,
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'BOTTLE_SHIPMENT_DELIVERED',
            details: `Livraison bouteilles #${event.id} confirmée par ${userEmail}.`,
            userId: userEmail,
          },
        });

        return {
          status: 'SUCCESS',
          type: input.type,
          id: event.id,
          deliveryStatus: 'LIVRE',
          deliveredAt,
          updated,
        };
      });
    }

    return prisma.$transaction(async (tx) => {
      const event = await tx.lotEvent.findUnique({
        where: { id: input.id },
      });

      if (!event || event.eventType !== 'EXPEDITION_VRAC') {
        throw new BusinessLogicError('Expédition vrac introuvable.', 404);
      }

      const metadata = asObject(event.metadata);
      if (metadata.deliveryStatus === 'LIVRE' || metadata.status === 'LIVREE') {
        throw new BusinessLogicError('Cette expédition vrac est déjà confirmée livrée.', 409);
      }

      const deliveredAt = new Date();
      const updated = await tx.lotEvent.update({
        where: { id: event.id },
        data: {
          metadata: {
            ...metadata,
            status: 'LIVREE',
            deliveryStatus: 'LIVRE',
            deliveredAt: deliveredAt.toISOString(),
            deliveredBy: userEmail,
          } satisfies Prisma.InputJsonObject,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'BULK_SHIPMENT_DELIVERED',
          details: `Livraison vrac #${event.id} confirmée par ${userEmail}.`,
          userId: userEmail,
        },
      });

      return {
        status: 'SUCCESS',
        type: input.type,
        id: event.id,
        deliveryStatus: 'LIVRE',
        deliveredAt,
        updated,
      };
    });
  }
}
