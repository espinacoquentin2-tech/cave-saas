import { BusinessLogicError } from '@/lib/errors';
import { MaturationService } from '@/services/maturation.service';
import { SaveMaturationInput } from '@/server/modules/maturation/maturation.schemas';
import { RequestActor } from '@/server/shared/request-context';
import { prisma } from '@/server/shared/prisma';

export class MaturationModuleService {
  static async list() {
    return prisma.maturation.findMany({
      orderBy: { date: 'asc' },
    });
  }

  static async save(input: SaveMaturationInput, actor: RequestActor) {
    try {
      return await MaturationService.saveRecord(input, actor.email);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur serveur';

      if (message.includes('ALREADY_APPLIED')) {
        throw new BusinessLogicError(message, 409);
      }

      throw new BusinessLogicError(message, 400);
    }
  }
}
