import type { Prisma } from '@prisma/client';

export class WorkOrderRepository {
  static findByPublicId(tx: Prisma.TransactionClient, publicId: string, organizationId: number) {
    return tx.workOrder.findFirst({ where: { publicId, organizationId } });
  }

  static cancel(
    tx: Prisma.TransactionClient,
    id: number,
    data: {
      cancelledAt: Date;
      cancelledBy: string;
      cancelReason: string;
    },
  ) {
    return tx.workOrder.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        ...data,
      },
    });
  }

  static createAuditLog(
    tx: Prisma.TransactionClient,
    data: { action: string; details: string; userId: string; organizationId: number },
  ) {
    return tx.auditLog.create({ data });
  }
}
