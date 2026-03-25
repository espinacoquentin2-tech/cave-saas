import { BusinessLogicError } from '@/lib/errors';
import { AdminService } from '@/services/admin.service';
import { CreateWorkOrderInput } from '@/server/modules/workorders/workorder.schemas';
import { RequestActor } from '@/server/shared/request-context';

export class WorkOrderModuleService {
  static async create(input: CreateWorkOrderInput, actor: RequestActor) {
    try {
      return await AdminService.createWorkOrder(input, actor.email);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur serveur';

      if (message.includes('ALREADY_APPLIED')) {
        throw new BusinessLogicError(message, 409);
      }

      if (message.includes('insuffisant') || message.includes('introuvable') || message.includes('trop petite')) {
        throw new BusinessLogicError(message, 400);
      }

      throw new BusinessLogicError(message, 400);
    }
  }
}
