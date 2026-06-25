import type { Prisma } from '@prisma/client';

export class WorkOrderRepository {
  static findByPublicId(tx: Prisma.TransactionClient, publicId: string) {
    return tx.workOrder.findUnique({ where: { publicId } });
  }

  static cancel(
    tx: Prisma.TransactionClient,
    publicId: string,
    data: {
      cancelledAt: Date;
      cancelledBy: string;
      cancelReason: string;
    },
  ) {
    return tx.workOrder.update({
      where: { publicId },
      data: {
        status: 'CANCELLED',
        ...data,
      },
    });
  }

  static createAuditLog(
    tx: Prisma.TransactionClient,
    data: { action: string; details: string; userId: string },
  ) {
    return tx.auditLog.create({ data });
  }
}
