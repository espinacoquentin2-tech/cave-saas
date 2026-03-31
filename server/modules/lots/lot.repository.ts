import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/server/shared/prisma';

export type LotTransaction = Prisma.TransactionClient;

const containerInclude = {
  currentLots: {
    where: {
      status: {
        in: ['ACTIF', 'BOURBES', 'LIES', 'ASSEMBLAGE'],
      },
    },
    select: {
      id: true,
      currentVolume: true,
    },
  },
} satisfies Prisma.ContainerInclude;

export class LotRepository {
  static readonly client: PrismaClient = prisma;

  static async withTransaction<T>(work: (tx: LotTransaction) => Promise<T>) {
    return this.client.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  static listLots() {
    return this.client.lot.findMany({
      orderBy: { id: 'asc' },
    });
  }

  static findIdempotencyRecord(tx: LotTransaction, key: string) {
    return tx.idempotencyRecord.findUnique({ where: { key } });
  }

  static createIdempotencyRecord(tx: LotTransaction, key: string, action: string, userEmail: string) {
    return tx.idempotencyRecord.create({
      data: {
        key,
        action,
        userId: userEmail,
      },
    });
  }

  static findUserByEmail(tx: LotTransaction, email: string) {
    return tx.user.findUnique({ where: { email } });
  }

  static findContainerWithLots(tx: LotTransaction, containerId: number) {
    return tx.container.findUnique({
      where: { id: containerId },
      include: containerInclude,
    });
  }

  static createLot(
    tx: LotTransaction,
    data: {
      technicalCode: string;
      businessCode: string;
      year: number;
      mainGrapeCode: string;
      placeCode?: string | null;
      sequenceNumber: number;
      currentVolume: Prisma.Decimal;
      currentContainerId: number;
      status: string;
      notes?: string | null;
    },
  ) {
    return tx.lot.create({ data });
  }

  static updateContainerStatus(tx: LotTransaction, containerId: number, status: string) {
    return tx.container.update({ where: { id: containerId }, data: { status } });
  }

  static createLotEvent(
    tx: LotTransaction,
    data: { eventType: string; operatorUserId: number; comment: string; eventDatetime?: Date },
  ) {
    return tx.lotEvent.create({ data });
  }

  static createLotEventLink(
    tx: LotTransaction,
    data: { eventId: number; lotId: number; roleInEvent: string; volumeChange: Prisma.Decimal },
  ) {
    return tx.lotEventLot.create({ data: { ...data, unit: 'hL' } });
  }

  static createContainerEventLink(
    tx: LotTransaction,
    data: { eventId: number; containerId: number; roleInEvent: string },
  ) {
    return tx.lotEventContainer.create({ data });
  }

  static createAuditLog(tx: LotTransaction, data: { action: string; details: string; userId: string }) {
    return tx.auditLog.create({ data });
  }

  static findLotById(tx: LotTransaction, lotId: number) {
    return tx.lot.findUnique({ where: { id: lotId } });
  }

  static updateLotVolume(tx: LotTransaction, lotId: number, currentVolume: Prisma.Decimal) {
    return tx.lot.update({ where: { id: lotId }, data: { currentVolume } });
  }
}
