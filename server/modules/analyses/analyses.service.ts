import { BusinessLogicError } from '@/lib/errors';
import { AnalysesService } from '@/services/analyses.service';
import { SaveAnalysesInput } from '@/server/modules/analyses/analyses.schemas';
import { RequestActor } from '@/server/shared/request-context';
import { prisma } from '@/server/shared/prisma';

export class AnalysesModuleService {
  static async list() {
    return prisma.analysis.findMany({
      orderBy: { analysisDate: 'desc' },
    });
  }

  static async save(input: SaveAnalysesInput, actor: RequestActor) {
    try {
      return await AnalysesService.saveRecords(input, actor.email);
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
