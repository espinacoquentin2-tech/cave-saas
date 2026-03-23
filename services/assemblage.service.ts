import { PrismaClient } from '@prisma/client';
import { AssemblageSchema } from '../validations/assemblage.schema';
import { z } from 'zod';

const prisma = new PrismaClient();

export class AssemblageService {
  static async execute(data: z.infer<typeof AssemblageSchema>, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Assemblage déjà effectué.");

      const user = await tx.user.findUnique({ where: { email: userEmail } });
      const operatorId = user?.id || 1;

      // 1. Création de l'événement racine
      const event = await tx.lotEvent.create({
        data: {
          eventType: 'ASSEMBLAGE',
          operatorUserId: operatorId,
          comment: `Création de l'assemblage ${data.code}. Composants: ${data.compoDetails || ''}`
        }
      });

      // 2. Déduction des Vracs (sourceLots)
      for (const src of data.sourceLots) {
        const lot = await tx.lot.findUnique({ where: { id: src.id } });
        if (!lot || lot.currentVolume < src.volumeUsed) throw new Error(`Stock insuffisant sur le lot ${src.id}`);
        
        const newVol = lot.currentVolume - src.volumeUsed;
        await tx.lot.update({
          where: { id: lot.id },
          data: { currentVolume: newVol, status: newVol <= 0.05 ? "ARCHIVE" : lot.status }
        });

        if (newVol <= 0.05 && lot.currentContainerId) {
          await tx.container.update({ where: { id: lot.currentContainerId }, data: { status: "NETTOYAGE" } });
        }

        await tx.lotEventLot.create({
          data: { eventId: event.id, lotId: lot.id, roleInEvent: 'SOURCE', volumeChange: src.volumeUsed }
        });
      }

      // 3. Déduction des Bouteilles (Vins de Réserve)
      for (const src of data.sourceBottles) {
        const blot = await tx.bottleLot.findUnique({ where: { id: src.id } });
        if (!blot || blot.currentBottleCount < src.countUsed) throw new Error(`Stock bouteilles insuffisant sur le lot ${src.id}`);
        
        const newCount = blot.currentBottleCount - src.countUsed;
        await tx.bottleLot.update({
          where: { id: blot.id },
          data: { currentBottleCount: newCount, status: newCount <= 0 ? "ARCHIVE" : blot.status }
        });

        // Liaison de la bouteille d'origine à l'événement de vrac (via sourceLotId pour garder l'historique)
        if (blot.sourceLotId) {
           await tx.lotEventLot.create({
             data: { eventId: event.id, lotId: blot.sourceLotId, roleInEvent: 'SOURCE_RESERVE', volumeChange: 0 }
           });
        }
      }

      // 4. Création du nouveau lot final
      const assemLot = await tx.lot.create({
        data: {
          technicalCode: `${data.code}-${Date.now().toString().slice(-4)}`,
          businessCode: data.code,
          year: typeof data.millesime === 'number' ? data.millesime : new Date().getFullYear(),
          mainGrapeCode: data.cepage,
          sequenceNumber: 1,
          currentVolume: data.volume,
          currentContainerId: data.targetContainerId,
          status: "ASSEMBLAGE",
          notes: data.compoDetails
        }
      });

      await tx.container.update({ where: { id: data.targetContainerId }, data: { status: "PLEIN" } });
      await tx.lotEventLot.create({ data: { eventId: event.id, lotId: assemLot.id, roleInEvent: 'CIBLE', volumeChange: data.volume } });

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "ASSEMBLAGE", userId: userEmail } });

      return { status: "SUCCESS", lot: assemLot };
    });
  }
}