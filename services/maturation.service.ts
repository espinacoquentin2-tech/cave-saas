// services/maturation.service.ts
import { SaveMaturationPayload } from '../validations/maturation.schema';
import { prisma } from '@/server/shared/prisma';


export class MaturationService {
  static async saveRecord(data: SaveMaturationPayload, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. IDEMPOTENCE
      const existingTx = await tx.idempotencyRecord.findUnique({
        where: { key: data.idempotencyKey }
      });
      if (existingTx) {
        throw new Error("ALREADY_APPLIED: Ce relevé a déjà été enregistré.");
      }

      // 2. CALCULS MÉTIER CÔTÉ BACKEND
      // Le TAVP est calculé en fonction du sucre (Rendement théorique Champagne: ~16.83 g/L pour 1% vol)
      let calculatedTavp = null;
      if (data.sucre && data.sucre > 0) {
        calculatedTavp = data.sucre / 16.83; 
      }

      const recordData = {
        date: new Date(data.date),
        parcelle: data.parcelle,
        cepage: data.cepage,
        sucre: data.sucre || null,
        tavp: calculatedTavp,
        ph: data.ph || null,
        at: data.at || null,
        malique: data.malique || null,
        tartrique: data.tartrique || null,
        maladie: data.maladie,
        intensite: data.maladie === "Aucune" ? 0 : (data.intensite || 0),
        notes: data.notes || null,
        operator: userEmail
      };

      let record;

      // 3. UPSERT (Mise à jour ou Création)
      if (data.id) {
        // Mise à jour
        const existing = await tx.maturation.findUnique({ where: { id: data.id } });
        if (!existing) throw new Error("Le relevé à modifier n'existe plus.");

        record = await tx.maturation.update({
          where: { id: data.id },
          data: recordData
        });
      } else {
        // Création
        record = await tx.maturation.create({
          data: recordData
        });
      }

      // 4. TRAÇABILITÉ
      await tx.idempotencyRecord.create({
        data: { key: data.idempotencyKey, action: "MATURATION_SAVE", userId: userEmail }
      });

      await tx.auditLog.create({
        data: { 
          action: "MATURATION_SAVE", 
          details: `${data.id ? 'Mise à jour' : 'Création'} relevé ${data.parcelle} (${data.date})`, 
          userId: userEmail 
        }
      });

      return { status: "SUCCESS", record };
    });
  }
}