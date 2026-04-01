import { BusinessLogicError } from '@/lib/errors';
import { AdminService } from '@/services/admin.service';
import { UpsertUserInput } from '@/server/modules/users/user.schemas';
import { RequestActor } from '@/server/shared/request-context';

export class UserModuleService {
  static async upsert(input: UpsertUserInput, actor: RequestActor) {
    try {
      return await AdminService.upsertUser(input, actor.email);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur serveur';

      if (message.includes('Droits insuffisants')) {
        throw new BusinessLogicError(message, 403);
      }

      if (message.includes('Unique constraint') || message.includes('déjà')) {
        throw new BusinessLogicError(message, 409);
      }

      throw new BusinessLogicError(message, 400);
    }
  }
}
