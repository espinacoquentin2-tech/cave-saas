// services/loss.service.ts
import { PrismaClient } from '@prisma/client';
import { ExecuteLossPayload } from '../validations/loss.schema';

const prisma = new PrismaClient();

export class LossService {
  static async executeLoss(data: ExecuteLossPayload, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. ANTI-DOUBLE CLIC (Idempotence)
      const existingTx = await tx.idempotencyRecord.findUnique({
        where: { key: data.idempotencyKey }
      });
      if (existingTx) {
        throw new Error("ALREADY_APPLIED: Cette perte a déjà été enregistrée.");
      }

      let updatedLot;

      // 2. LOGIQUE VRAC (BULK)
      if (data.entityType === "BULK") {
        const lot = await tx.lot.findUnique({ where: { id: parseInt(data.entityId) } });
        if (!lot) throw new Error("Lot Vrac introuvable.");
        if ((lot.currentVolume || 0) < data.amount) throw new Error(`Volume insuffisant. Dispo: ${lot.currentVolume} hL.`);

        updatedLot = await tx.lot.update({
          where: { id: lot.id },
          data: { currentVolume: (lot.currentVolume || 0) - data.amount }
        });

        // 3. LOGIQUE BOUTEILLES (BOTTLE)
      } else if (data.entityType === "BOTTLE") {
        const bottleLot = await tx.bottleLot.findUnique({ where: { id: parseInt(data.entityId) } });
        if (!bottleLot) throw new Error("Lot de bouteilles introuvable.");
        if ((bottleLot.currentBottleCount || 0) < data.amount) throw new Error(`Stock insuffisant. Dispo: ${bottleLot.currentBottleCount} btl.`);

        updatedLot = await tx.bottleLot.update({
          where: { id: bottleLot.id },
          data: { currentBottleCount: (bottleLot.currentBottleCount || 0) - data.amount }
        });
      }

      // 4. CRÉATION DE L'ÉVÈNEMENT (Traçabilité)
      const isDistillerie = data.note.toUpperCase().includes("DISTILLERIE");
      const eventType = isDistillerie ? "DISTILLERIE" : (data.entityType === "BOTTLE" ? "CASSE" : "PERTE");

      const newEvent = await tx.lotEvent.create({
        data: {
          eventType: eventType,
          eventDatetime: new Date(),
          comment: data.note,
          // 👈 CORRECTION 1 : Connexion formelle à la table User
          operator: { 
            connect: { email: userEmail } 
          }
        }
      });

      // 5. LIAISON DE L'ÉVÈNEMENT AU LOT
      if (data.entityType === "BULK") {
        await tx.lotEventLot.create({
          data: {
            eventId: newEvent.id,
            lotId: parseInt(data.entityId),
            volumeChange: data.amount,
            // 👈 CORRECTION 2 : Ajout du rôle obligatoire
            roleInEvent: "SOURCE" 
          }
        });
      } else {
        // Logique pour les bouteilles si vous avez une table de liaison similaire
        // await tx.lotEventBottle.create({ ... })
      }

      // 6. SÉCURITÉ IDEMPOTENCE ET AUDIT
      await tx.idempotencyRecord.create({
        data: { key: data.idempotencyKey, action: "LOSS_DECLARATION", userId: userEmail }
      });

      await tx.auditLog.create({
        data: { 
          action: "LOSS_DECLARATION", 
          details: `Déclaration: ${data.amount} ${data.entityType === "BULK" ? "hL" : "btl"} sur lot ${updatedLot?.businessCode || data.entityId}`, 
          userId: userEmail 
        }
      });

      return { status: "SUCCESS", entityType: data.entityType, amount: data.amount };
    });
  }
}