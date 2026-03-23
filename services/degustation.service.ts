// services/degustation.service.ts
import { PrismaClient } from '@prisma/client';
import { SaveDegustationPayload } from '../validations/degustation.schema';

const prisma = new PrismaClient();

export class DegustationService {
  static async saveRecord(data: SaveDegustationPayload, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. IDEMPOTENCE
      const existingTx = await tx.idempotencyRecord.findUnique({
        where: { key: data.idempotencyKey }
      });
      if (existingTx) {
        throw new Error("ALREADY_APPLIED: Cette dégustation a déjà été enregistrée.");
      }

      // 2. INSERTION DU RELEVÉ
      const record = await tx.degustation.create({
        data: {
          date: new Date(data.date),
          phase: data.phase,
          parcelle: data.parcelle,
          lotId: data.lotId,
          bottleLotId: data.bottleLotId,
          robe: data.robe,
          nez: data.nez,
          bouche: data.bouche,
          noteGlobale: data.noteGlobale,
          sucreTest: data.phase === "DOSAGE" ? data.sucreTest : null, // Sécurité métier
          notes: data.notes,
          operator: userEmail
        }
      });

      // 3. TRAÇABILITÉ
      await tx.idempotencyRecord.create({
        data: { key: data.idempotencyKey, action: "DEGUSTATION_SAVE", userId: userEmail }
      });

      const targetName = data.parcelle || data.lotId || data.bottleLotId || "Inconnu";
      await tx.auditLog.create({
        data: { 
          action: "DEGUSTATION_SAVE", 
          details: `Dégustation (${data.phase}) sur ${targetName} - Note: ${data.noteGlobale || '-'}`, 
          userId: userEmail 
        }
      });

      return { status: "SUCCESS", record };
    });
  }
}