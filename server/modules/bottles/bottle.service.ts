import { BusinessLogicError } from '@/lib/errors';
import { BottlesService } from '@/services/bottles.service';
import {
  DegorgerInput,
  ExpedierInput,
  HabillerInput,
  UpdateBottleStatusInput,
} from '@/server/modules/bottles/bottle.schemas';
import { RequestActor } from '@/server/shared/request-context';

const mapBottleError = (error: unknown) => {
  const message = error instanceof Error ? error.message : 'Erreur serveur';

  if (message.includes('ALREADY_APPLIED')) {
    throw new BusinessLogicError(message, 409);
  }

  if (
    message.includes('insuffisant') ||
    message.includes('introuvable') ||
    message.includes('non autorisé') ||
    message.includes('insuffisant pour la matière sèche')
  ) {
    throw new BusinessLogicError(message, 400);
  }

  throw new BusinessLogicError(message, 400);
};

export class BottleModuleService {
  static async updateStatus(input: UpdateBottleStatusInput, actor: RequestActor) {
    try {
      return await BottlesService.updateStatus(input, actor.email);
    } catch (error) {
      mapBottleError(error);
    }
  }

  static async degorger(input: DegorgerInput, actor: RequestActor) {
    try {
      return await BottlesService.degorger(input, actor.email);
    } catch (error) {
      mapBottleError(error);
    }
  }

  static async habiller(input: HabillerInput, actor: RequestActor) {
    try {
      return await BottlesService.habiller(input, actor.email);
    } catch (error) {
      mapBottleError(error);
    }
  }

  static async expedier(input: ExpedierInput, actor: RequestActor) {
    try {
      return await BottlesService.expedier(input, actor.email);
    } catch (error) {
      mapBottleError(error);
    }
  }
}
