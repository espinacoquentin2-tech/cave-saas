import 'server-only';
import { Prisma } from '@prisma/client';
import { BusinessLogicError } from '@/lib/errors';
import { prisma } from '@/server/shared/prisma';

export class LevainRepository {
  static async withTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
        throw new BusinessLogicError('Opération déjà traitée ou données modifiées. Actualisez les volumes avant de réessayer.', 409);
      }
      throw error;
    }
  }
}
