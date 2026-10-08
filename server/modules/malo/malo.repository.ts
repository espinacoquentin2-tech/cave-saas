import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/shared/prisma";
import { BusinessLogicError } from "@/lib/errors";
export class MaloRepository {
  static async withTransaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2002", "P2034"].includes(e.code)
      )
        throw new BusinessLogicError(
          "Opération déjà traitée ou données modifiées. Actualisez le dossier.",
          409,
        );
      throw e;
    }
  }
}
