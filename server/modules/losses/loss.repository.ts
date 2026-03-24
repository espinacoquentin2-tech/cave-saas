import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/server/shared/prisma';

export type LossTransaction = Prisma.TransactionClient;

export class LossRepository {
  static readonly client: PrismaClient = prisma;

  static async withTransaction<T>(work: (tx: LossTransaction) => Promise<T>) {
    return this.client.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  static findIdempotencyRecord(tx: LossTransaction, key: string) {
    return tx.idempotencyRecord.findUnique({ where: { key } });
  }

  static createIdempotencyRecord(tx: LossTransaction, key: string, userEmail: string) {
    return tx.idempotencyRecord.create({
      data: {
        key,
        action: 'LOSS_DECLARATION',
        userId: userEmail,
      },
    });
  }

  static findUserByEmail(tx: LossTransaction, email: string) {
    return tx.user.findUnique({ where: { email } });
  }

  static findLot(tx: LossTransaction, lotId: number) {
    return tx.lot.findUnique({ where: { id: lotId } });
  }

  static decrementLot(tx: LossTransaction, lotId: number, amount: Prisma.Decimal) {
    return tx.lot.updateMany({
      where: {
        id: lotId,
        currentVolume: { gte: amount },
      },
      data: {
        currentVolume: { decrement: amount },
      },
    });
  }

  static updateLotStatus(tx: LossTransaction, lotId: number, status: string) {
    return tx.lot.update({ where: { id: lotId }, data: { status } });
  }

  static updateContainerStatus(tx: LossTransaction, containerId: number, status: string) {
    return tx.container.update({ where: { id: containerId }, data: { status } });
  }

  static createLotEvent(
    tx: LossTransaction,
    data: {
      eventType: string;
      operatorUserId: number;
      eventDatetime: Date;
      comment: string;
    },
  ) {
    return tx.lotEvent.create({ data });
  }

  static createLotEventLink(
    tx: LossTransaction,
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

  static findBottleLot(tx: LossTransaction, bottleLotId: number) {
    return tx.bottleLot.findUnique({ where: { id: bottleLotId } });
  }

  static decrementBottleLot(tx: LossTransaction, bottleLotId: number, amount: number) {
    return tx.bottleLot.updateMany({
      where: {
        id: bottleLotId,
        currentBottleCount: { gte: amount },
      },
      data: {
        currentBottleCount: { decrement: amount },
      },
    });
  }

  static updateBottleLotStatus(tx: LossTransaction, bottleLotId: number, status: string) {
    return tx.bottleLot.update({ where: { id: bottleLotId }, data: { status } });
  }

  static createBottleEvent(
    tx: LossTransaction,
    data: {
      eventType: string;
      operatorUserId: number;
      eventDatetime: Date;
      comment: string;
    },
  ) {
    return tx.bottleEvent.create({ data });
  }

  static createBottleEventLink(
    tx: LossTransaction,
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
    tx: LossTransaction,
    data: {
      action: string;
      details: string;
      userId: string;
    },
  ) {
    return tx.auditLog.create({ data });
  }
}
