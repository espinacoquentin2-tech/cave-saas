import { BusinessLogicError } from '@/lib/errors';
import { LotsService } from '@/services/lots.service';
import { AddIntrantInput } from '@/server/modules/intrants/intrant.schemas';
import { RequestActor } from '@/server/shared/request-context';

export class IntrantModuleService {
  static async add(input: AddIntrantInput, actor: RequestActor) {
    try {
      return await LotsService.addIntrant(input, actor.email);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur serveur';

      if (message.includes('ALREADY_APPLIED')) {
        throw new BusinessLogicError(message, 409);
      }

      if (message.includes('AOC:')) {
        throw new BusinessLogicError(message, 400);
      }

      throw new BusinessLogicError(message, 400);
    }
  }
}
