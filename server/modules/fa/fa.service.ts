import { BusinessLogicError } from '@/lib/errors';
import { LotsService } from '@/services/lots.service';
import { SaveFaTourInput } from '@/server/modules/fa/fa.schemas';
import { RequestActor } from '@/server/shared/request-context';

export class FaModuleService {
  static async saveTour(input: SaveFaTourInput, actor: RequestActor) {
    try {
      return await LotsService.saveFaTour(input, actor.email);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur serveur';

      if (message.includes('ALREADY_APPLIED')) {
        throw new BusinessLogicError(message, 409);
      }

      throw new BusinessLogicError(message, 400);
    }
  }
}
