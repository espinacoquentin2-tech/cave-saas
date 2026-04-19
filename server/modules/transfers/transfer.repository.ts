import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/server/shared/prisma';

export type TransferTransaction = Prisma.TransactionClient;

export interface TransferSourceSnapshot {
  id: number;
  technicalCode: string;
  businessCode: string;
  year: number;
  mainGrapeCode: string;
  sequenceNumber: number;
  status: string;
  currentVolume: Prisma.Decimal;
  currentContainerId: number | null;
  currentContainer: {
    id: number;
    code: string;
    displayName: string;
    type: string;
    capacityValue: Prisma.Decimal;
    status: string;
  } | null;
}

const baseSourceInclude = {
  currentContainer: {
    select: {
      id: true,
      code: true,
      displayName: true,
      type: true,
      capacityValue: true,
      status: true,
    },
  },
} satisfies Prisma.LotInclude;

const targetInclude = {
  currentLots: {
    where: {
      status: {
        in: ['ACTIF', 'BOURBES', 'LIES', 'ASSEMBLAGE'],
      },
    },
    select: {
      id: true,
      currentVolume: true,
      status: true,
    },
  },
} satisfies Prisma.ContainerInclude;

export class TransferRepository {
  static readonly client: PrismaClient = prisma;

  static async withTransaction<T>(work: (tx: TransferTransaction) => Promise<T>) {
    return this.client.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  static findIdempotencyRecord(tx: TransferTransaction, key: string) {
    return tx.idempotencyRecord.findUnique({ where: { key } });
  }

  static createIdempotencyRecord(tx: TransferTransaction, key: string, userEmail: string) {
    return tx.idempotencyRecord.create({
      data: {
        key,
        action: 'TRANSFER',
        userId: userEmail,
      },
    });
  }

  static findUserByEmail(tx: TransferTransaction, email: string) {
    return tx.user.findUnique({ where: { email } });
  }

  static findSourceLot(tx: TransferTransaction, lotId: number) {
    return tx.lot.findUnique({
      where: { id: lotId },
      include: baseSourceInclude,
    }) as Promise<TransferSourceSnapshot | null>;
  }

  static findTargetContainers(tx: TransferTransaction, containerIds: number[]) {
    return tx.container.findMany({
      where: { id: { in: containerIds } },
      include: targetInclude,
    });
  }

  static decrementSourceLot(tx: TransferTransaction, lotId: number, volume: Prisma.Decimal) {
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

  static updateSourceLotStatus(tx: TransferTransaction, lotId: number, status: string, currentContainerId: number | null) {
    return tx.lot.update({
      where: { id: lotId },
      data: {
        status,
        currentContainerId,
      },
    });
  }

  static createChildLot(
    tx: TransferTransaction,
    data: {
      technicalCode: string;
      businessCode: string;
      year: number;
      mainGrapeCode: string;
      sequenceNumber: number;
      currentVolume: Prisma.Decimal;
      currentContainerId: number;
      status: string;
      notes: string;
    },
  ) {
    return tx.lot.create({ data });
  }

  static updateContainerStatus(tx: TransferTransaction, containerId: number, status: string) {
    return tx.container.update({
      where: { id: containerId },
      data: { status },
    });
  }

  static createTransferEvent(
    tx: TransferTransaction,
    data: {
      operatorUserId: number;
      eventDatetime: Date;
      comment: string;
    },
  ) {
    return tx.lotEvent.create({
      data: {
        eventType: 'TRANSFERT',
        ...data,
      },
    });
  }

  static createLotEventLink(
    tx: TransferTransaction,
    data: {
      eventId: number;
      lotId: number;
      roleInEvent: string;
      volumeChange: Prisma.Decimal;
      unit?: string;
    },
  ) {
    return tx.lotEventLot.create({
      data: {
        unit: 'hL',
        ...data,
      },
    });
  }

  static createContainerEventLink(
    tx: TransferTransaction,
    data: {
      eventId: number;
      containerId: number;
      roleInEvent: string;
    },
  ) {
    return tx.lotEventContainer.create({ data });
  }

  static createAuditLog(
    tx: TransferTransaction,
    data: {
      action: string;
      details: string;
      userId: string;
    },
  ) {
    return tx.auditLog.create({ data });
  }
}
