import { BusinessLogicError } from '@/lib/errors';
import { BottlesService } from '@/services/bottles.service';
import {
  DegorgerInput,
  ExpedierInput,
  HabillerInput,
  UpdateBottleStatusInput,
  ListBottleLotsQueryInput,
} from '@/server/modules/bottles/bottle.schemas';
import { RequestActor } from '@/server/shared/request-context';
import { prisma } from '@/server/shared/prisma'

const mapBottleError = (error: unknown) => {
  const message = error instanceof Error ? error.message : 'Erreur serveur';

  if (message.includes('ALREADY_APPLIED')) {
    throw new BusinessLogicError(message, 409);
  }

  if (
    message.includes('insuffisant') ||
    message.includes('introuvable') ||
    message.includes('non autorisé') ||
    message.includes('insuffisant pour la matière sèche')
  ) {
    throw new BusinessLogicError(message, 400);
  }

  throw new BusinessLogicError(message, 400);
};

export class BottleModuleService {
  static async list(input: ListBottleLotsQueryInput) {
  return prisma.bottleLot.findMany({
    where: input.id ? { id: input.id } : undefined,
    orderBy: { id: 'desc' },
  });
}

static async delete(id: number, actor: RequestActor) {
  const fmtHL = { '37.5cl': 0.00375, '75cl': 0.0075, '150cl': 0.015, '300cl': 0.03 } as const;

  return prisma.$transaction(async (tx) => {
    const bottleLot = await tx.bottleLot.findUnique({ where: { id } });
    if (!bottleLot) {
      throw new BusinessLogicError('Lot de bouteilles introuvable.', 404);
    }

    await tx.bottleEventLink.deleteMany({ where: { bottleLotId: id } });

    if (bottleLot.sourceLotId) {
      const volumeToRestore =
        bottleLot.initialBottleCount * (fmtHL[bottleLot.formatCode as keyof typeof fmtHL] ?? 0.0075);

      const lot = await tx.lot.findUnique({ where: { id: bottleLot.sourceLotId } });
      if (lot) {
        await tx.lot.update({
          where: { id: bottleLot.sourceLotId },
          data: {
            currentVolume: Number(lot.currentVolume) + volumeToRestore,
            status: lot.status === 'TIRE' ? 'ACTIF' : lot.status,
          },
        });
      }
    }

    await tx.bottleLot.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        action: 'BOTTLE_LOT_DELETED',
        details: `Suppression lot bouteilles #${id}`,
        userId: actor.email,
      },
    });

    return { status: 'SUCCESS' };
  });
}
  static async updateStatus(input: UpdateBottleStatusInput, actor: RequestActor) {
    try {
      return await BottlesService.updateStatus(input, actor.email);
    } catch (error) {
      mapBottleError(error);
    }
  }

  static async degorger(input: DegorgerInput, actor: RequestActor) {
    try {
      return await BottlesService.degorger(input, actor.email);
    } catch (error) {
      mapBottleError(error);
    }
  }

  static async habiller(input: HabillerInput, actor: RequestActor) {
    try {
      return await BottlesService.habiller(input, actor.email);
    } catch (error) {
      mapBottleError(error);
    }
  }

  static async expedier(input: ExpedierInput, actor: RequestActor) {
    try {
      return await BottlesService.expedier(input, actor.email);
    } catch (error) {
      mapBottleError(error);
    }
  }
}
