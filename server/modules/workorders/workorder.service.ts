import { BusinessLogicError } from '@/lib/errors';
import { AdminService } from '@/services/admin.service';
import { CancelWorkOrderInput, CreateWorkOrderInput } from '@/server/modules/workorders/workorder.schemas';
import { RequestActor } from '@/server/shared/request-context';

export class WorkOrderModuleService {
  static async list(actor: RequestActor) {
    return {
      workOrders: await AdminService.listWorkOrders(actor.organizationId),
    };
  }

  static async create(input: CreateWorkOrderInput, actor: RequestActor) {
    try {
      return await AdminService.createWorkOrder(input, actor.email, actor.organizationId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur serveur';

      if (message.includes('ALREADY_APPLIED')) {
        throw new BusinessLogicError(message, 409);
      }

      if (message.includes('Role incoherent')) {
        throw new BusinessLogicError(message, 409);
      }

      if (message.includes('insuffisant') || message.includes('introuvable') || message.includes('trop petite')) {
        throw new BusinessLogicError(message, 400);
      }

      throw new BusinessLogicError(message, 400);
    }
  }

  static async complete(publicId: string, evidence: unknown, actor: RequestActor) {
    try {
      return {
        workOrder: await AdminService.completeWorkOrder(publicId, evidence, actor.email, actor.organizationId),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur serveur';

      if (message.includes('ALREADY_APPLIED') || message.includes('WORK_ORDER_CANCELLED')) {
        throw new BusinessLogicError(message, 409);
      }

      if (message.includes('introuvable')) {
        throw new BusinessLogicError(message, 404);
      }

      throw new BusinessLogicError(message, 400);
    }
  }

  static async cancel(publicId: string, input: CancelWorkOrderInput, actor: RequestActor) {
    try {
      return {
        workOrder: await AdminService.cancelWorkOrder(publicId, input.reason, actor.email, actor.organizationId),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur serveur';

      if (message.includes('introuvable')) {
        throw new BusinessLogicError(message, 404);
      }

      if (
        message.includes('WORK_ORDER_DONE') ||
        message.includes('ALREADY_CANCELLED') ||
        message.includes('WORK_ORDER_NOT_PENDING')
      ) {
        throw new BusinessLogicError(message, 409);
      }

      throw new BusinessLogicError(message, 400);
    }
  }
}
