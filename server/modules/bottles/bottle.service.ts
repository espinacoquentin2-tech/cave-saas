import { BusinessLogicError } from '@/lib/errors';
import { BottlesService } from '@/services/bottles.service';
import {
  DegorgerInput,
  ExpedierInput,
  HabillerInput,
  ListBottleLotsQueryInput,
  UpdateBottleStatusInput,
  ArchiveBottleLotInput,
  CancelBottleEventInput,
} from '@/server/modules/bottles/bottle.schemas';
import { RequestActor } from '@/server/shared/request-context';
import { prisma } from '@/server/shared/prisma';

const mapBottleError = (error: unknown): never => {
  if (error instanceof BusinessLogicError) {
    throw error;
  }

  const message = error instanceof Error ? error.message : 'Erreur serveur';

  if (message.includes('ALREADY_APPLIED')) {
    throw new BusinessLogicError(message, 409);
  }

  if (
    message.includes('a déjà été traité') ||
    message.includes('a changé pendant') ||
    message.includes('rechargez') ||
    message.includes('concurrent') ||
    message.includes('parallèle')
  ) {
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
      include: {
        bottleEventLinks: {
          include: {
            event: {
              include: {
                operator: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: { id: 'desc' },
        },
        sourceLot: {
          include: {
            components: true,
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
          },
        },
      },
    });
  }

  // Legacy dangerous delete. Disabled at route level. Do not call for production workflows.
  static async delete(id: number, actor: RequestActor) {
    throw new BusinessLogicError(
      `La suppression physique du lot bouteilles #${id} est désactivée pour ${actor.email}. Utilise l'archivage contrôlé.`,
      405,
    );
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

  static async archive(input: ArchiveBottleLotInput, actor: RequestActor) {
    try {
      return await BottlesService.archive(input, actor.email);
    } catch (error) {
      mapBottleError(error);
    }
  }

  static async cancelEvent(input: CancelBottleEventInput, actor: RequestActor) {
    try {
      return await BottlesService.cancelEvent(input, actor.email);
    } catch (error) {
      mapBottleError(error);
    }
  }
}
