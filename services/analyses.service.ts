<<<<<<< HEAD
import { Prisma } from '@prisma/client';
=======
import { Prisma, PrismaClient } from '@prisma/client';
>>>>>>> main
import { SaveAnalysesPayload } from '../validations/analyses.schema';
import { prisma } from '@/server/shared/prisma';


export class AnalysesService {
  static async saveRecords(data: SaveAnalysesPayload, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. IDEMPOTENCE
      const existingTx = await tx.idempotencyRecord.findUnique({
        where: { key: data.idempotencyKey }
      });
      if (existingTx) {
        throw new Error("ALREADY_APPLIED: Ces analyses ont déjà été importées.");
      }

      // 2. VÉRIFICATION DES LOTS
      const lotIds = [...new Set(data.analyses.map(a => a.lotId))];
      const existingLots = await tx.lot.findMany({
        where: { id: { in: lotIds } },
        select: { id: true, businessCode: true }
      });

      if (existingLots.length !== lotIds.length) {
        throw new Error("Un ou plusieurs lots sélectionnés n'existent pas dans la base de données.");
      }

      // 3. PRÉPARATION DES DONNÉES
      const recordsToInsert = data.analyses.map(a => ({
        analysisDate: new Date(a.analysisDate),
        lotId: a.lotId,
        ph: a.ph || null,
        at: a.at || null,
        so2Free: a.so2Free || null,
        so2Total: a.so2Total || null,
        alcohol: a.alcohol || null,
        notes: a.notes || null,
        // 👈 UTILISATION DU TIROIR MAGIQUE : On y cache l'opérateur pour la traçabilité
        extraData: { operator: userEmail, source: "App Saisie", ...(a.extraData || {}) } as Prisma.JsonObject
      }));

      // Utilisation du modèle "analysis" (avec un Y) tel que défini dans Prisma
      const result = await tx.analysis.createMany({
        data: recordsToInsert
      });

      // 4. TRAÇABILITÉ (Audit Log)
      await tx.idempotencyRecord.create({
        data: { key: data.idempotencyKey, action: "ANALYSES_IMPORT", userId: userEmail }
      });

      const lotCodes = existingLots.map(l => l.businessCode).join(", ");
      await tx.auditLog.create({
        data: { 
          action: "ANALYSES_IMPORT", 
          details: `${result.count} analyse(s) enregistrée(s) pour les lots: ${lotCodes}`, 
          userId: userEmail 
        }
      });

      return { status: "SUCCESS", count: result.count };
    });
  }
}
