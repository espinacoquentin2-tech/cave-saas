import { BusinessLogicError } from '@/lib/errors';
import { AnalysesService } from '@/services/analyses.service';
import { SaveAnalysesInput } from '@/server/modules/analyses/analyses.schemas';
import { RequestActor } from '@/server/shared/request-context';
import { prisma } from '@/server/shared/prisma';

export class AnalysesModuleService {
  static async list(actor: RequestActor) {
    const records = await prisma.analysis.findMany({
      where: { organizationId: actor.organizationId },
      select: {
        id: true,
        lotId: true,
        analysisDate: true,
        ph: true,
        at: true,
        so2Free: true,
        so2Total: true,
        alcohol: true,
        fileUrl: true,
        notes: true,
        extraData: true,
      },
      orderBy: { analysisDate: 'desc' },
    });

    return records.map((analysis) => ({
      id: analysis.id,
      lotId: analysis.lotId,
      analysisDate: analysis.analysisDate.toISOString(),
      ph: analysis.ph,
      at: analysis.at,
      so2Free: analysis.so2Free,
      so2Total: analysis.so2Total,
      alcohol: analysis.alcohol,
      fileUrl: analysis.fileUrl,
      notes: analysis.notes,
      extraData: analysis.extraData ?? {},
    }));
  }

  static async save(input: SaveAnalysesInput, actor: RequestActor) {
    try {
      return await AnalysesService.saveRecords(input, actor.email, actor.organizationId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur serveur';

      if (message.includes('ALREADY_APPLIED')) {
        throw new BusinessLogicError(message, 409);
      }

      if (message.includes('n\'existent pas')) {
        throw new BusinessLogicError(message, 400);
      }

      throw new BusinessLogicError(message, 400);
    }
  }
}
