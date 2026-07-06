import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/server/shared/prisma';

export type LotTransaction = Prisma.TransactionClient;

const containerInclude = {
  currentLots: {
    where: {
      status: {
        notIn: ['ARCHIVE', 'ARCHIVÉ', 'TIRE', 'MIS_EN_BOUTEILLE'],
      },
      currentVolume: { gt: new Prisma.Decimal(0) },
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

  static listLots(organizationId: number) {
    return this.client.lot.findMany({
      where: { organizationId },
      orderBy: { id: 'asc' },
      include: {
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
        components: {
          orderBy: { id: 'asc' },
        },
        analyses: {
          orderBy: { analysisDate: 'desc' },
          take: 3,
        },
      },
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

  static findContainerWithLots(tx: LotTransaction, containerId: number, organizationId: number) {
    return tx.container.findFirst({
      where: { id: containerId, organizationId },
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
      qualiteLot?: string | null;
      notes?: string | null;
      organizationId: number;
    },
  ) {
    return tx.lot.create({ data });
  }

  static updateContainerStatus(tx: LotTransaction, containerId: number, organizationId: number, status: string) {
    return tx.container.updateMany({ where: { id: containerId, organizationId }, data: { status } });
  }

  static createLotEvent(
    tx: LotTransaction,
    data: {
      eventType: string;
      operatorUserId: number;
      comment: string;
      eventDatetime?: Date;
      metadata?: Prisma.InputJsonValue;
      organizationId: number;
    },
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

  static createAuditLog(tx: LotTransaction, data: { action: string; details: string; userId: string; organizationId: number }) {
    return tx.auditLog.create({ data });
  }

  static findLotById(tx: LotTransaction, lotId: number, organizationId: number) {
    return tx.lot.findFirst({ where: { id: lotId, organizationId } });
  }

  static async updateLotVolume(
    tx: LotTransaction,
    lotId: number,
    organizationId: number,
    currentVolume: Prisma.Decimal,
  ) {
    const updateResult = await tx.lot.updateMany({ where: { id: lotId, organizationId }, data: { currentVolume } });
    if (updateResult.count !== 1) {
      return null;
    }

    return tx.lot.findFirst({ where: { id: lotId, organizationId } });
  }
}
