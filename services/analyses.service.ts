import { Prisma } from '@prisma/client';
import { SaveAnalysesPayload } from '../validations/analyses.schema';
import { prisma } from '@/server/shared/prisma';

export class AnalysesService {
  static async saveRecords(data: SaveAnalysesPayload, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({
        where: { key: data.idempotencyKey },
      });
      if (existingTx) {
        throw new Error('ALREADY_APPLIED: Ces analyses ont déjà été importées.');
      }

      const lotIds = [...new Set(data.analyses.map((a) => a.lotId))];
      const existingLots = await tx.lot.findMany({
        where: { id: { in: lotIds } },
        select: { id: true, businessCode: true },
      });

      if (existingLots.length !== lotIds.length) {
        throw new Error("Un ou plusieurs lots sélectionnés n'existent pas dans la base de données.");
      }

      const recordsToInsert = data.analyses.map((a) => ({
        analysisDate: new Date(a.analysisDate),
        lotId: a.lotId,
        ph: a.ph || null,
        at: a.at || null,
        so2Free: a.so2Free || null,
        so2Total: a.so2Total || null,
        alcohol: a.alcohol || null,
        notes: a.notes || null,
        extraData: { operator: userEmail, source: 'App Saisie', ...(a.extraData || {}) } as Prisma.JsonObject,
      }));

      const result = await tx.analysis.createMany({
        data: recordsToInsert,
      });

      await tx.idempotencyRecord.create({
        data: { key: data.idempotencyKey, action: 'ANALYSES_IMPORT', userId: userEmail },
      });

      const lotCodes = existingLots.map((l) => l.businessCode).join(', ');
      await tx.auditLog.create({
        data: {
          action: 'ANALYSES_IMPORT',
          details: `${result.count} analyse(s) enregistrée(s) pour les lots: ${lotCodes}`,
          userId: userEmail,
        },
      });

      return { status: 'SUCCESS', count: result.count };
    });
  }
}
