import { BusinessLogicError } from '@/lib/errors';
import { AssemblageService } from '@/services/assemblage.service';
import { CreateAssemblageInput } from '@/server/modules/assemblage/assemblage.schemas';
import { RequestActor } from '@/server/shared/request-context';

export class AssemblageModuleService {
  static async execute(input: CreateAssemblageInput, actor: RequestActor) {
    try {
      return await AssemblageService.execute(
        {
          ...input,
          operator: actor.email,
        },
        actor.email,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur serveur';

      if (message.includes('ALREADY_APPLIED')) {
        throw new BusinessLogicError(message, 409);
      }

      if (message.includes('insuffisant') || message.includes('introuvable')) {
        throw new BusinessLogicError(message, 400);
      }

      throw new BusinessLogicError(message, 400);
    }
  }
}
