import { BusinessLogicError } from '@/lib/errors';
import { InventoryService } from '@/services/inventory.service';
import { CreateInventoryProductInput } from '@/server/modules/inventory-products/inventory-product.schemas';
import { RequestActor } from '@/server/shared/request-context';
import { prisma } from '@/server/shared/prisma';

export class InventoryProductModuleService {
  static async create(input: CreateInventoryProductInput, actor: RequestActor) {
    try {
      return await InventoryService.createProduct(input, actor.email, actor.organizationId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur serveur';

      if (message.includes('ALREADY_APPLIED')) {
        throw new BusinessLogicError(message, 409);
      }

      throw new BusinessLogicError(message, 400);
    }
  }

  static async list(actor: RequestActor) {
    return prisma.product.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { name: 'asc' },
    });
  }
}
