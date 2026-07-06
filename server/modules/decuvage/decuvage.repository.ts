import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/server/shared/prisma';

export type DecuvageTransaction = Prisma.TransactionClient;

const sourceInclude = {
  currentContainer: {
    select: {
      id: true,
      displayName: true,
      capacityValue: true,
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
    },
  },
} satisfies Prisma.ContainerInclude;

export class DecuvageRepository {
  static readonly client: PrismaClient = prisma;

  static async withTransaction<T>(work: (tx: DecuvageTransaction) => Promise<T>) {
    return this.client.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  static findIdempotencyRecord(tx: DecuvageTransaction, key: string) {
    return tx.idempotencyRecord.findUnique({ where: { key } });
  }

  static createIdempotencyRecord(tx: DecuvageTransaction, key: string, userEmail: string) {
    return tx.idempotencyRecord.create({
      data: {
        key,
        action: 'DECUVAGE',
        userId: userEmail,
      },
    });
  }

  static findUserByEmail(tx: DecuvageTransaction, email: string) {
    return tx.user.findUnique({ where: { email } });
  }

  static findSourceLot(tx: DecuvageTransaction, lotId: number, organizationId: number) {
    return tx.lot.findFirst({ where: { id: lotId, organizationId }, include: sourceInclude });
  }

  static findContainers(tx: DecuvageTransaction, containerIds: number[], organizationId: number) {
    return tx.container.findMany({ where: { id: { in: containerIds }, organizationId }, include: targetInclude });
  }

  static archiveSourceLot(tx: DecuvageTransaction, lotId: number, organizationId: number) {
    return tx.lot.updateMany({
      where: { id: lotId, organizationId },
      data: { currentVolume: new Prisma.Decimal(0), status: 'ARCHIVE', currentContainerId: null },
    });
  }

  static updateContainerStatus(tx: DecuvageTransaction, containerId: number, organizationId: number, status: string) {
    return tx.container.updateMany({ where: { id: containerId, organizationId }, data: { status } });
  }

  static createLotEvent(
    tx: DecuvageTransaction,
    data: { operatorUserId: number; comment: string; eventDatetime?: Date; organizationId: number },
  ) {
    return tx.lotEvent.create({ data: { eventType: 'DECUVAGE', ...data } });
  }

  static createLotEventLink(
    tx: DecuvageTransaction,
    data: { eventId: number; lotId: number; roleInEvent: string; volumeChange: Prisma.Decimal },
  ) {
    return tx.lotEventLot.create({ data: { ...data, unit: 'hL' } });
  }

  static createContainerEventLink(
    tx: DecuvageTransaction,
    data: { eventId: number; containerId: number; roleInEvent: string },
  ) {
    return tx.lotEventContainer.create({ data });
  }

  static createLot(
    tx: DecuvageTransaction,
    data: {
      technicalCode: string;
      businessCode: string;
      year: number;
      mainGrapeCode: string;
      sequenceNumber: number;
      currentVolume: Prisma.Decimal;
      currentContainerId?: number | null;
      status: string;
      notes?: string | null;
      organizationId: number;
    },
  ) {
    return tx.lot.create({ data });
  }

  static createAuditLog(tx: DecuvageTransaction, data: { action: string; details: string; userId: string; organizationId: number }) {
    return tx.auditLog.create({ data });
  }
}
