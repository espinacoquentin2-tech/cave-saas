import { BusinessLogicError } from '@/lib/errors';
import { DegustationService } from '@/services/degustation.service';
import { SaveDegustationInput } from '@/server/modules/degustations/degustation.schemas';
import { RequestActor } from '@/server/shared/request-context';
import { prisma } from '@/server/shared/prisma';

export class DegustationModuleService {
  static async list(actor: RequestActor) {
    return prisma.degustation.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { date: 'desc' },
    });
  }

  static async save(input: SaveDegustationInput, actor: RequestActor) {
    try {
      return await DegustationService.saveRecord(input, actor.email, actor.organizationId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur serveur';

      if (message.includes('ALREADY_APPLIED')) {
        throw new BusinessLogicError(message, 409);
      }

      throw new BusinessLogicError(message, 400);
    }
  }
}
