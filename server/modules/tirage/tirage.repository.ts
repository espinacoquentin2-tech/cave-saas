import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/server/shared/prisma';

export type TirageTransaction = Prisma.TransactionClient;

const sourceLotInclude = {
  currentContainer: {
    select: {
      id: true,
      code: true,
      displayName: true,
      status: true,
    },
  },
  analyses: {
    orderBy: {
      analysisDate: 'desc',
    },
    take: 1,
    select: {
      id: true,
      analysisDate: true,
      alcohol: true,
      extraData: true,
    },
  },
} satisfies Prisma.LotInclude;

export class TirageRepository {
  static readonly client: PrismaClient = prisma;

  static async withTransaction<T>(work: (tx: TirageTransaction) => Promise<T>) {
    return this.client.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  static findIdempotencyRecord(tx: TirageTransaction, key: string) {
    return tx.idempotencyRecord.findUnique({ where: { key } });
  }

  static createIdempotencyRecord(tx: TirageTransaction, key: string, userEmail: string) {
    return tx.idempotencyRecord.create({
      data: {
        key,
        action: 'TIRAGE',
        userId: userEmail,
      },
    });
  }

  static findUserByEmail(tx: TirageTransaction, email: string) {
    return tx.user.findUnique({ where: { email } });
  }

  static findSourceLot(tx: TirageTransaction, lotId: number, organizationId: number) {
    return tx.lot.findFirst({
      where: { id: lotId, organizationId },
      include: sourceLotInclude,
    });
  }

  static decrementSourceLot(tx: TirageTransaction, lotId: number, organizationId: number, volume: Prisma.Decimal) {
    return tx.lot.updateMany({
      where: {
        id: lotId,
        organizationId,
        currentVolume: { gte: volume },
      },
      data: {
        currentVolume: { decrement: volume },
      },
    });
  }

  static updateSourceLotStatus(tx: TirageTransaction, lotId: number, organizationId: number, status: string) {
    return tx.lot.updateMany({
      where: { id: lotId, organizationId },
      data: { status },
    });
  }

  static updateSourceLotForTirage(
    tx: TirageTransaction,
    lotId: number,
    organizationId: number,
    data: {
      status?: string;
      currentContainerId?: number | null;
    },
  ) {
    return tx.lot.updateMany({
      where: { id: lotId, organizationId },
      data,
    });
  }

  static countBottleLotsByTypeAndYear(tx: TirageTransaction, type: string, year: number, organizationId: number) {
    return tx.bottleLot.count({
      where: {
        organizationId,
        type,
        businessCode: {
          startsWith: `${type}-${year}-`,
        },
      },
    });
  }

  static createBottleLot(
    tx: TirageTransaction,
    data: Prisma.BottleLotUncheckedCreateInput,
  ) {
    return tx.bottleLot.create({ data });
  }

  static createLotEvent(
    tx: TirageTransaction,
    data: {
      operatorUserId: number;
      eventType: string;
      comment: string;
      eventDatetime: Date;
      metadata?: Prisma.InputJsonValue;
      organizationId: number;
    },
  ) {
    return tx.lotEvent.create({ data });
  }

  static createLotEventLink(
    tx: TirageTransaction,
    data: {
      eventId: number;
      lotId: number;
      roleInEvent: string;
      volumeChange: Prisma.Decimal;
    },
  ) {
    return tx.lotEventLot.create({
      data: {
        unit: 'hL',
        ...data,
      },
    });
  }

  static createLotEventContainerLink(
    tx: TirageTransaction,
    data: {
      eventId: number;
      containerId: number;
      roleInEvent: string;
    },
  ) {
    return tx.lotEventContainer.create({ data });
  }

  static createBottleEvent(
    tx: TirageTransaction,
    data: {
      operatorUserId: number;
      eventType: string;
      comment: string;
      eventDatetime: Date;
      metadata?: Prisma.InputJsonValue;
      organizationId: number;
    },
  ) {
    return tx.bottleEvent.create({ data });
  }

  static createBottleEventLink(
    tx: TirageTransaction,
    data: {
      eventId: number;
      bottleLotId: number;
      roleInEvent: string;
      bottleCount: number;
    },
  ) {
    return tx.bottleEventLink.create({ data });
  }

  static createAuditLog(
    tx: TirageTransaction,
    data: {
      action: string;
      details: string;
      userId: string;
      organizationId: number;
    },
  ) {
    return tx.auditLog.create({ data });
  }

  static countActiveLotsInContainer(tx: TirageTransaction, containerId: number, organizationId: number) {
    return tx.lot.count({
      where: {
        currentContainerId: containerId,
        organizationId,
        currentVolume: { gt: 0 },
        status: {
          notIn: ['TIRE', 'ARCHIVE', 'MIS_EN_BOUTEILLE'],
        },
      },
    });
  }

  static updateContainerStatus(tx: TirageTransaction, containerId: number, organizationId: number, status: string) {
    return tx.container.updateMany({
      where: { id: containerId, organizationId },
      data: { status },
    });
  }

  static findProductsByIds(tx: TirageTransaction, productIds: number[], organizationId: number) {
    return tx.product.findMany({
      where: {
        organizationId,
        id: {
          in: productIds,
        },
      },
    });
  }

  static decrementProductStock(tx: TirageTransaction, productId: number, organizationId: number, quantity: Prisma.Decimal) {
    return tx.product.updateMany({
      where: {
        id: productId,
        organizationId,
        currentStock: { gte: quantity },
      },
      data: {
        currentStock: { decrement: quantity },
      },
    });
  }

  static findIntrantByCode(tx: TirageTransaction, code: string) {
    return tx.intrant.findUnique({
      where: { code },
    });
  }

  static createIntrant(
    tx: TirageTransaction,
    data: {
      code: string;
      name: string;
      category: string;
      mainUnit: string;
    },
  ) {
    return tx.intrant.create({ data });
  }

  static createLotEventIntrant(
    tx: TirageTransaction,
    data: {
      eventId: number;
      intrantId: number;
      quantity: Prisma.Decimal;
      unit: string;
    },
  ) {
    return tx.lotEventIntrant.create({ data });
  }

  static createStockMovement(
    tx: TirageTransaction,
    data: {
      productId: number;
      type: string;
      quantity: Prisma.Decimal;
      note: string;
      operator: string;
      organizationId: number;
    },
  ) {
    return tx.stockMovement.create({ data });
  }
}
