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

  static findSourceLot(tx: TirageTransaction, lotId: number) {
    return tx.lot.findUnique({
      where: { id: lotId },
      include: sourceLotInclude,
    });
  }

  static decrementSourceLot(tx: TirageTransaction, lotId: number, volume: Prisma.Decimal) {
    return tx.lot.updateMany({
      where: {
        id: lotId,
        currentVolume: { gte: volume },
      },
      data: {
        currentVolume: { decrement: volume },
      },
    });
  }

  static updateSourceLotStatus(tx: TirageTransaction, lotId: number, status: string) {
    return tx.lot.update({
      where: { id: lotId },
      data: { status },
    });
  }

  static countBottleLotsByTypeAndYear(tx: TirageTransaction, type: string, year: number) {
    return tx.bottleLot.count({
      where: {
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

  static createBottleEvent(
    tx: TirageTransaction,
    data: {
      operatorUserId: number;
      eventType: string;
      comment: string;
      eventDatetime: Date;
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
    },
  ) {
    return tx.auditLog.create({ data });
  }
}
