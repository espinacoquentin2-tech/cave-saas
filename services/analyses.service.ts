import { Prisma } from '@prisma/client';
import { SaveAnalysesPayload } from '../validations/analyses.schema';
import { validateMaloAnalysisContext } from '@/server/modules/malo/malo-control.service';
import { prisma } from '@/server/shared/prisma';

export class AnalysesService {
  static async saveRecords(data: SaveAnalysesPayload, userEmail: string, organizationId: number) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({
        where: { key: data.idempotencyKey },
      });
      if (existingTx) {
        throw new Error('ALREADY_APPLIED: Ces analyses ont déjà été importées.');
      }

      const lotIds = [...new Set(data.analyses.map((a) => a.lotId))];
      const existingLots = await tx.lot.findMany({
        where: { id: { in: lotIds }, organizationId },
        select: { id: true, businessCode: true, maloRole: true, maloPreparationId: true, currentContainerId: true, maloCompositionEventId: true },
      });

      if (existingLots.length !== lotIds.length) {
        throw new Error("Un ou plusieurs lots sélectionnés n'existent pas dans la base de données.");
      }

      for (const a of data.analyses) {
        const lot = existingLots.find(l => l.id === a.lotId)!;
        if (!lot.maloRole) continue;
        const composition = lot.maloCompositionEventId ? await tx.lotEvent.findFirst({ where: { id: lot.maloCompositionEventId, organizationId } }) : null;
        if (!composition) throw new Error('Préparation sans composition enregistrée.');
        const context = validateMaloAnalysisContext(lot, a.extraData?.malo, composition.eventDatetime);
        if (new Date(a.analysisDate).getTime() !== new Date(context.sampledAt).getTime()) throw new Error('La date d’analyse doit être celle du prélèvement.');
        for (const field of ['malique', 'temperatureC', 'density', 'density20', 'sucresResiduel', 'aciditeVolatile']) {
          const value = a.extraData?.[field];
          if (value != null && (typeof value !== 'number' || !Number.isFinite(value) || (field !== 'temperatureC' && value < 0))) throw new Error('Mesure analytique invalide.');
        }
      }
      const recordsToInsert = data.analyses.map((a) => ({
        analysisDate: new Date(a.analysisDate),
        lotId: a.lotId,
        ph: a.ph ?? null,
        at: a.at ?? null,
        so2Free: a.so2Free ?? null,
        so2Total: a.so2Total ?? null,
        alcohol: a.alcohol ?? null,
        organizationId,
        notes: a.notes || null,
        extraData: { ...(a.extraData || {}), operator: userEmail, source: 'App Saisie', idempotencyKey: data.idempotencyKey } as Prisma.JsonObject,
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
          organizationId,
        },
      });

      return { status: 'SUCCESS', count: result.count };
    });
  }
}
