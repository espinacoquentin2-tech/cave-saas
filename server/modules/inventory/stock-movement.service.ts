import { Prisma } from '@prisma/client';
import { BusinessLogicError } from '@/lib/errors';
import {
  CreateStockMovementInput,
  ListStockMovementsQuery,
} from '@/server/modules/inventory/stock-movement.schemas';
import { StockMovementRepository } from '@/server/modules/inventory/stock-movement.repository';
import { RequestActor } from '@/server/shared/request-context';

const toDecimal = (value: number) => new Prisma.Decimal(value.toFixed(3));

interface StockMovementResult {
  movementId: number;
  newStock: number;
}

export class StockMovementModuleService {
  static async create(input: CreateStockMovementInput, actor: RequestActor): Promise<StockMovementResult> {
    return StockMovementRepository.withTransaction(async (tx) => {
      const existingRequest = await StockMovementRepository.findIdempotencyRecord(tx, input.idempotencyKey);
      if (existingRequest) {
        throw new BusinessLogicError('Ce mouvement de stock a déjà été traité.', 409);
      }

      const operator = await StockMovementRepository.findUserByEmail(tx, actor.email);
      if (!operator) {
        throw new BusinessLogicError('Utilisateur opérateur introuvable.', 401);
      }

      const product = await StockMovementRepository.findProduct(tx, input.productId);
      if (!product) {
        throw new BusinessLogicError('Produit introuvable.', 404);
      }

      const quantity = toDecimal(input.quantity);
      let newStock: number;

      if (input.type === 'IN') {
        const updatedProduct = await StockMovementRepository.incrementProductStock(tx, product.id, quantity);
        newStock = Number(updatedProduct.currentStock);
      } else {
        if (Number(product.currentStock) < input.quantity) {
          throw new BusinessLogicError(
            `Stock insuffisant. Disponible: ${Number(product.currentStock)} ${product.unit}, demandé: ${input.quantity}.`,
            409,
          );
        }

        const decrementResult = await StockMovementRepository.decrementProductStock(tx, product.id, quantity);
        if (decrementResult.count !== 1) {
          throw new BusinessLogicError(
            'Le stock a changé pendant l\'opération. Rechargez les données puis réessayez.',
            409,
          );
        }

        newStock = Number(product.currentStock) - input.quantity;
      }

      const movement = await StockMovementRepository.createMovement(tx, {
        productId: product.id,
        type: input.type,
        quantity,
        note: input.note ?? null,
        operator: actor.email,
      });

      await StockMovementRepository.createIdempotencyRecord(tx, input.idempotencyKey, actor.email);
      await StockMovementRepository.createAuditLog(tx, {
        action: 'STOCK_MOVEMENT_EXECUTED',
        details: `Mouvement ${input.type} de ${input.quantity} ${product.unit} sur ${product.name} par ${actor.email}.`,
        userId: actor.email,
      });

      return {
        movementId: movement.id,
        newStock: Number(newStock.toFixed(3)),
      };
    });
  }

  static async list(query: ListStockMovementsQuery) {
    const [items, total] = await Promise.all([
      StockMovementRepository.listMovements(query.page, query.limit),
      StockMovementRepository.countMovements(),
    ]);

    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }
}
