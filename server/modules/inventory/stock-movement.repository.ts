import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/server/shared/prisma';

export type StockMovementTransaction = Prisma.TransactionClient;

export class StockMovementRepository {
  static readonly client: PrismaClient = prisma;

  static async withTransaction<T>(work: (tx: StockMovementTransaction) => Promise<T>) {
    return this.client.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  static findIdempotencyRecord(tx: StockMovementTransaction, key: string) {
    return tx.idempotencyRecord.findUnique({ where: { key } });
  }

  static createIdempotencyRecord(tx: StockMovementTransaction, key: string, userEmail: string) {
    return tx.idempotencyRecord.create({
      data: {
        key,
        action: 'STOCK_MOVEMENT',
        userId: userEmail,
      },
    });
  }

  static findUserByEmail(tx: StockMovementTransaction, email: string) {
    return tx.user.findUnique({ where: { email } });
  }

  static findProduct(tx: StockMovementTransaction, productId: number) {
    return tx.product.findUnique({ where: { id: productId } });
  }

  static incrementProductStock(tx: StockMovementTransaction, productId: number, quantity: Prisma.Decimal) {
    return tx.product.update({
      where: { id: productId },
      data: {
        currentStock: { increment: quantity },
      },
    });
  }

  static decrementProductStock(tx: StockMovementTransaction, productId: number, quantity: Prisma.Decimal) {
    return tx.product.updateMany({
      where: {
        id: productId,
        currentStock: { gte: quantity },
      },
      data: {
        currentStock: { decrement: quantity },
      },
    });
  }

  static createMovement(
    tx: StockMovementTransaction,
    data: {
      productId: number;
      type: 'IN' | 'OUT';
      quantity: Prisma.Decimal;
      note: string | null;
      operator: string;
    },
  ) {
    return tx.stockMovement.create({ data });
  }

  static createAuditLog(
    tx: StockMovementTransaction,
    data: {
      action: string;
      details: string;
      userId: string;
    },
  ) {
    return tx.auditLog.create({ data });
  }

  static listMovements(page: number, limit: number) {
    return this.client.stockMovement.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            unit: true,
          },
        },
      },
    });
  }

  static countMovements() {
    return this.client.stockMovement.count();
  }
}
