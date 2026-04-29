import { Prisma, PrismaClient } from '@prisma/client';
import {
  AssemblageDecisionComponent,
  AssemblageType,
  convertBottleCountToHl,
  convertHlToBottleCount,
  evaluateAssemblageDecision,
  getBottleFormatLabel,
  normalizeGrapeCode,
} from '@/lib/assemblage';
import { BusinessLogicError } from '@/lib/errors';
import { CreateAssemblageInput } from '@/server/modules/assemblage/assemblage.schemas';
import { prisma } from '@/server/shared/prisma';
import { RequestActor } from '@/server/shared/request-context';

type Tx = Prisma.TransactionClient;

type NormalizedAssemblageSource =
  | {
      sourceType: 'LOT';
      lotId: number;
      volumeHl: number;
      originUnit: string;
      originQuantity: number;
    }
  | {
      sourceType: 'BOTTLE_LOT';
      bottleLotId: number;
      volumeHl: number;
      originUnit: string;
      originQuantity: number;
      formatCode?: string;
    };

type NormalizedAdjuvant = {
  productId: number;
  dose: number;
  doseUnit: string;
  treatedVolumeHl: number;
  quantityTotal: number;
  quantityUnit: string;
};

const DESTINATION_EXCLUDED_TYPES = new Set([
  'CUVE_BOURBES',
  'CUVE_LIES',
  'CUVE_DEBOURBAGE',
  'COMPARTIMENT',
]);

const EMPTY_LOT_STATUSES = new Set(['ARCHIVE', 'ARCHIVÉ', 'TIRE', 'MIS_EN_BOUTEILLE']);

const round = (value: number, precision = 4) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const toDecimal = (value: number, precision = 4) => new Prisma.Decimal(round(value, precision).toFixed(precision));

const toNumber = (value: Prisma.Decimal | number | string | null | undefined) => Number(value ?? 0);

const buildSourceSummary = (components: AssemblageDecisionComponent[]) =>
  components
    .map((component) => `${component.label}: ${component.volumeHl.toFixed(2)} hL`)
    .join(' | ');

const normalizeAssemblageInput = (input: CreateAssemblageInput) => {
  const destinationContainerId = input.containerDestinationId ?? input.targetContainerId;
  const sources: NormalizedAssemblageSource[] = [];

  if (input.components.length > 0) {
    for (const component of input.components) {
      if (component.sourceType === 'LOT') {
        sources.push({
          sourceType: 'LOT',
          lotId: component.lotId,
          volumeHl: component.volumeHl,
          originUnit: component.originUnit,
          originQuantity: component.originQuantity ?? component.volumeHl,
        });
      } else {
        sources.push({
          sourceType: 'BOTTLE_LOT',
          bottleLotId: component.bottleLotId,
          volumeHl: component.volumeHl,
          originUnit: component.originUnit,
          originQuantity: component.originQuantity,
          formatCode: component.formatCode,
        });
      }
    }
  } else {
    for (const sourceLot of input.sourceLots) {
      sources.push({
        sourceType: 'LOT',
        lotId: sourceLot.id,
        volumeHl: sourceLot.volumeUsed,
        originUnit: 'hL',
        originQuantity: sourceLot.volumeUsed,
      });
    }

    for (const sourceBottle of input.sourceBottles) {
      sources.push({
        sourceType: 'BOTTLE_LOT',
        bottleLotId: sourceBottle.id,
        volumeHl: convertBottleCountToHl(sourceBottle.countUsed, sourceBottle.format),
        originUnit: sourceBottle.format,
        originQuantity: sourceBottle.countUsed,
        formatCode: sourceBottle.format,
      });
    }
  }

  return {
    code: input.code.trim(),
    assemblageType: input.assemblageType ?? null,
    millesime: input.millesime,
    volume: input.volume,
    cepage: input.cepage?.trim() || null,
    destinationContainerId,
    notes: input.notes?.trim() || null,
    compoDetails: input.compoDetails?.trim() || null,
    idempotencyKey: input.idempotencyKey,
    sources,
    adjuvants: input.adjuvants.map(
      (adjuvant): NormalizedAdjuvant => ({
        productId: adjuvant.productId,
        dose: adjuvant.dose,
        doseUnit: adjuvant.doseUnit.trim(),
        treatedVolumeHl: adjuvant.treatedVolumeHl,
        quantityTotal: adjuvant.quantityTotal,
        quantityUnit: adjuvant.quantityUnit.trim(),
      }),
    ),
  };
};

const buildDecisionComponentFromLot = (lot: {
  businessCode: string;
  year: number;
  status: string;
  qualiteLot: string | null;
  notes: string | null;
  mainGrapeCode: string;
  components: { grapeCode: string; percentage: Prisma.Decimal }[];
}) => (volumeHl: number): AssemblageDecisionComponent => ({
  label: lot.businessCode,
  volumeHl,
  vintage: lot.year,
  isReserve: lot.status === 'RESERVE' || lot.qualiteLot === 'RESERVE',
  isRedWine:
    lot.status === 'VIN_ROUGE' ||
    lot.businessCode.toUpperCase().includes('ROUGE') ||
    lot.notes?.toUpperCase().includes('ROUGE') === true,
  cepageBreakdown:
    lot.components.length > 0
      ? lot.components.map((component) => ({
          grapeCode: component.grapeCode,
          percentage: toNumber(component.percentage),
        }))
      : [{ grapeCode: lot.mainGrapeCode, percentage: 100 }],
});

const buildRequestedTypeWarning = (requestedType: AssemblageType | null, suggestedType: AssemblageType) => {
  if (!requestedType || requestedType === 'ASSEMBLAGE_LIBRE' || requestedType === suggestedType) {
    return null;
  }

  return `Type demandé: ${requestedType}. Type suggéré: ${suggestedType}.`;
};

export class AssemblageModuleService {
  static readonly client: PrismaClient = prisma;

  static async execute(input: CreateAssemblageInput, actor: RequestActor) {
    const normalized = normalizeAssemblageInput(input);

    if (!normalized.destinationContainerId) {
      throw new BusinessLogicError('Cuve de destination introuvable.', 400);
    }

    return this.client.$transaction(
      async (tx) => {
        const existingRequest = await tx.idempotencyRecord.findUnique({
          where: { key: normalized.idempotencyKey },
        });
        if (existingRequest) {
          throw new BusinessLogicError('Cet assemblage a déjà été traité.', 409);
        }

        const operator = await tx.user.findUnique({ where: { email: actor.email } });
        if (!operator) {
          throw new BusinessLogicError('Utilisateur opérateur introuvable.', 401);
        }

        const lotSourceIds = normalized.sources
          .filter((source): source is Extract<NormalizedAssemblageSource, { sourceType: 'LOT' }> => source.sourceType === 'LOT')
          .map((source) => source.lotId);
        const bottleSourceIds = normalized.sources
          .filter(
            (source): source is Extract<NormalizedAssemblageSource, { sourceType: 'BOTTLE_LOT' }> =>
              source.sourceType === 'BOTTLE_LOT',
          )
          .map((source) => source.bottleLotId);

        const [destinationContainer, sourceLots, sourceBottleLots, products] = await Promise.all([
          tx.container.findUnique({
            where: { id: normalized.destinationContainerId },
            include: {
              currentLots: {
                where: {
                  status: { notIn: Array.from(EMPTY_LOT_STATUSES) },
                },
                select: {
                  id: true,
                  currentVolume: true,
                },
              },
            },
          }),
          lotSourceIds.length > 0
            ? tx.lot.findMany({
                where: { id: { in: lotSourceIds } },
                include: {
                  components: true,
                  currentContainer: {
                    select: { id: true, code: true, displayName: true, status: true },
                  },
                },
              })
            : Promise.resolve([]),
          bottleSourceIds.length > 0
            ? tx.bottleLot.findMany({
                where: { id: { in: bottleSourceIds } },
                include: {
                  sourceLot: {
                    include: {
                      components: true,
                      currentContainer: {
                        select: { id: true, code: true, displayName: true, status: true },
                      },
                    },
                  },
                },
              })
            : Promise.resolve([]),
          normalized.adjuvants.length > 0
            ? tx.product.findMany({
                where: { id: { in: normalized.adjuvants.map((adjuvant) => adjuvant.productId) } },
              })
            : Promise.resolve([]),
        ]);

        if (!destinationContainer || destinationContainer.status === 'ARCHIVÉE') {
          throw new BusinessLogicError('Cuve de destination introuvable ou archivée.', 404);
        }

        if (DESTINATION_EXCLUDED_TYPES.has(destinationContainer.type)) {
          throw new BusinessLogicError(
            `Le contenant ${destinationContainer.displayName} n'est pas compatible avec un assemblage final.`,
            400,
          );
        }

        const occupiedVolume = round(
          destinationContainer.currentLots.reduce((sum, lot) => sum + toNumber(lot.currentVolume), 0),
          4,
        );
        if (occupiedVolume > 0.0001) {
          throw new BusinessLogicError(
            `La cuve ${destinationContainer.displayName} n'est pas vide (${occupiedVolume.toFixed(2)} hL présents).`,
            409,
          );
        }

        const sourceLotMap = new Map(sourceLots.map((lot) => [lot.id, lot] as const));
        const sourceBottleMap = new Map(sourceBottleLots.map((bottleLot) => [bottleLot.id, bottleLot] as const));
        const productMap = new Map(products.map((product) => [product.id, product] as const));
        const decisionComponents: AssemblageDecisionComponent[] = [];
        const sourceContainerIds = new Set<number>();
        let totalVolumeHl = 0;

        for (const source of normalized.sources) {
          if (source.sourceType === 'LOT') {
            const lot = sourceLotMap.get(source.lotId);
            if (!lot) {
              throw new BusinessLogicError(`Lot source introuvable (#${source.lotId}).`, 404);
            }
            if (source.volumeHl > toNumber(lot.currentVolume)) {
              throw new BusinessLogicError(
                `Volume insuffisant sur ${lot.businessCode}. Disponible: ${toNumber(lot.currentVolume).toFixed(2)} hL.`,
                409,
              );
            }

            totalVolumeHl += source.volumeHl;
            decisionComponents.push(buildDecisionComponentFromLot(lot)(source.volumeHl));
            if (lot.currentContainerId) {
              sourceContainerIds.add(lot.currentContainerId);
            }
          } else {
            const bottleLot = sourceBottleMap.get(source.bottleLotId);
            if (!bottleLot) {
              throw new BusinessLogicError(`Lot bouteille source introuvable (#${source.bottleLotId}).`, 404);
            }

            const resolvedFormat = source.formatCode ?? bottleLot.formatCode;
            const convertedCount = convertHlToBottleCount(source.volumeHl, resolvedFormat);
            const expectedVolume = convertBottleCountToHl(source.originQuantity, resolvedFormat);

            if (convertedCount == null) {
              throw new BusinessLogicError(
                `Le volume ${source.volumeHl.toFixed(4)} hL ne correspond pas à un nombre entier de ${getBottleFormatLabel(resolvedFormat)}.`,
                400,
              );
            }
            if (source.originQuantity > bottleLot.currentBottleCount) {
              throw new BusinessLogicError(
                `Stock bouteille insuffisant sur ${bottleLot.businessCode}. Disponible: ${bottleLot.currentBottleCount}.`,
                409,
              );
            }
            if (Math.abs(expectedVolume - source.volumeHl) > 0.0001) {
              throw new BusinessLogicError(
                `Conversion incohérente pour ${bottleLot.businessCode}. ${source.originQuantity} unités = ${expectedVolume.toFixed(4)} hL.`,
                400,
              );
            }

            totalVolumeHl += source.volumeHl;
            const bottleSourceLot = bottleLot.sourceLot;
            decisionComponents.push(
              bottleSourceLot
                ? buildDecisionComponentFromLot(bottleSourceLot)(source.volumeHl)
                : {
                    label: bottleLot.businessCode,
                    volumeHl: source.volumeHl,
                    vintage: null,
                    isReserve: bottleLot.status === 'RESERVE',
                    isRedWine: bottleLot.businessCode.toUpperCase().includes('ROUGE'),
                    cepageBreakdown: [{ grapeCode: 'INCONNU', percentage: 100 }],
                  },
            );
            if (bottleSourceLot?.currentContainerId) {
              sourceContainerIds.add(bottleSourceLot.currentContainerId);
            }
          }
        }

        totalVolumeHl = round(totalVolumeHl, 4);
        if (totalVolumeHl <= 0) {
          throw new BusinessLogicError("Le volume final de l'assemblage doit etre positif.", 400);
        }

        if (normalized.volume && Math.abs(normalized.volume - totalVolumeHl) > 0.01) {
          throw new BusinessLogicError(
            `Le volume transmis (${normalized.volume.toFixed(2)} hL) ne correspond pas au volume calculé (${totalVolumeHl.toFixed(2)} hL).`,
            400,
          );
        }

        const capacity = toNumber(destinationContainer.capacityValue);
        if (totalVolumeHl > capacity) {
          throw new BusinessLogicError(
            `Capacité dépassée pour ${destinationContainer.displayName}. ${totalVolumeHl.toFixed(2)} hL > ${capacity.toFixed(2)} hL.`,
            409,
          );
        }

        const decision = evaluateAssemblageDecision(decisionComponents, normalized.assemblageType);
        const requestedTypeWarning = buildRequestedTypeWarning(normalized.assemblageType, decision.suggestedType);

        for (const adjuvant of normalized.adjuvants) {
          const product = productMap.get(adjuvant.productId);
          if (!product) {
            throw new BusinessLogicError(`Produit intrant introuvable (#${adjuvant.productId}).`, 404);
          }
          if (product.unit !== adjuvant.quantityUnit) {
            throw new BusinessLogicError(
              `Unité incompatible pour ${product.name}. Stock en ${product.unit}, quantité calculée en ${adjuvant.quantityUnit}.`,
              400,
            );
          }
          if (adjuvant.quantityTotal > toNumber(product.currentStock)) {
            throw new BusinessLogicError(
              `Stock insuffisant pour ${product.name}. Disponible: ${toNumber(product.currentStock).toFixed(2)} ${product.unit}.`,
              409,
            );
          }
        }

        const vintageKeys = Object.keys(decision.compositionByVintage)
          .map((value) => Number.parseInt(value, 10))
          .filter((value) => Number.isFinite(value));
        const finalYear =
          typeof normalized.millesime === 'number'
            ? normalized.millesime
            : decision.isMillesimeCandidate && vintageKeys.length === 1
              ? vintageKeys[0]
              : vintageKeys.length > 0
                ? Math.max(...vintageKeys)
                : new Date().getFullYear();

        const dominantGrapes = Object.entries(decision.compositionByCepage).sort((a, b) => b[1] - a[1]);
        const dominantGrape =
          normalized.cepage && normalized.cepage !== 'MULTI'
            ? normalized.cepage
            : dominantGrapes.length === 1
              ? dominantGrapes[0][0]
              : 'MULTI';
        const finalNotes = [
          normalized.notes,
          normalized.compoDetails,
          `Type demandé: ${normalized.assemblageType ?? 'NON_PRECISÉ'}`,
          `Type suggéré: ${decision.suggestedType}`,
          requestedTypeWarning,
          decision.warnings.length > 0 ? `Alertes: ${decision.warnings.join(' | ')}` : null,
          `Composition: ${Object.entries(decision.compositionByCepage)
            .map(([grape, percentage]) => `${grape} ${percentage.toFixed(2)} %`)
            .join(' / ')}`,
          `Millésimes: ${Object.entries(decision.compositionByVintage)
            .map(([vintage, percentage]) => `${vintage} ${percentage.toFixed(2)} %`)
            .join(' / ') || 'Sans millésime exploitable'}`,
        ]
          .filter(Boolean)
          .join('\n');

        const event = await tx.lotEvent.create({
          data: {
            eventType: 'ASSEMBLAGE',
            operatorUserId: operator.id,
            comment: [
              `Création de l'assemblage ${normalized.code}.`,
              `Type suggéré: ${decision.suggestedType}.`,
              buildSourceSummary(decisionComponents),
              normalized.notes,
            ]
              .filter(Boolean)
              .join(' '),
          },
        });

        for (const source of normalized.sources) {
          if (source.sourceType === 'LOT') {
            const lot = sourceLotMap.get(source.lotId);
            if (!lot) {
              continue;
            }

            const nextVolume = round(toNumber(lot.currentVolume) - source.volumeHl, 4);
            await tx.lot.update({
              where: { id: lot.id },
              data: {
                currentVolume: toDecimal(Math.max(nextVolume, 0)),
                status: nextVolume <= 0.0001 ? 'ARCHIVE' : lot.status,
                currentContainerId: nextVolume <= 0.0001 ? null : lot.currentContainerId,
              },
            });
            await tx.lotEventLot.create({
              data: {
                eventId: event.id,
                lotId: lot.id,
                roleInEvent: 'SOURCE',
                volumeChange: toDecimal(source.volumeHl),
                unit: 'hL',
              },
            });
          } else {
            const bottleLot = sourceBottleMap.get(source.bottleLotId);
            if (!bottleLot) {
              continue;
            }

            const nextBottleCount = bottleLot.currentBottleCount - source.originQuantity;
            await tx.bottleLot.update({
              where: { id: bottleLot.id },
              data: {
                currentBottleCount: nextBottleCount,
                status: nextBottleCount <= 0 ? 'ARCHIVE' : bottleLot.status,
              },
            });
            if (bottleLot.sourceLotId) {
              await tx.lotEventLot.create({
                data: {
                  eventId: event.id,
                  lotId: bottleLot.sourceLotId,
                  roleInEvent: 'SOURCE_BOUTEILLE',
                  volumeChange: toDecimal(source.volumeHl),
                  unit: 'hL',
                },
              });
            }
          }
        }

        const lot = await tx.lot.create({
          data: {
            technicalCode: `${normalized.code}-${Date.now().toString().slice(-6)}`,
            businessCode: normalized.code,
            year: finalYear,
            mainGrapeCode: normalizeGrapeCode(dominantGrape),
            placeCode: destinationContainer.code,
            sequenceNumber: 1,
            status: 'ASSEMBLAGE',
            currentVolume: toDecimal(totalVolumeHl),
            currentVolumeUnit: 'hL',
            currentContainerId: destinationContainer.id,
            qualiteLot: normalized.assemblageType ?? decision.suggestedType,
            notes: finalNotes,
          },
        });

        await tx.lotComponent.createMany({
          data: Object.entries(decision.compositionByCepage).map(([grapeCode, percentage]) => ({
            lotId: lot.id,
            grapeCode,
            percentage: toDecimal(percentage, 2),
          })),
        });

        await tx.lotEventLot.create({
          data: {
            eventId: event.id,
            lotId: lot.id,
            roleInEvent: 'CIBLE',
            volumeChange: toDecimal(totalVolumeHl),
            unit: 'hL',
          },
        });

        for (const containerId of sourceContainerIds) {
          await tx.lotEventContainer.create({
            data: {
              eventId: event.id,
              containerId,
              roleInEvent: 'SOURCE',
            },
          });
        }

        await tx.lotEventContainer.create({
          data: {
            eventId: event.id,
            containerId: destinationContainer.id,
            roleInEvent: 'CIBLE',
          },
        });

        await tx.container.update({
          where: { id: destinationContainer.id },
          data: {
            status: totalVolumeHl >= capacity - 0.0001 ? 'PLEIN' : 'EN_SERVICE',
          },
        });

        for (const containerId of sourceContainerIds) {
          const remainingLots = await tx.lot.count({
            where: {
              currentContainerId: containerId,
              currentVolume: { gt: 0 },
              status: { notIn: Array.from(EMPTY_LOT_STATUSES) },
            },
          });
          if (remainingLots === 0) {
            await tx.container.update({
              where: { id: containerId },
              data: { status: 'VIDE' },
            });
          }
        }

        for (const adjuvant of normalized.adjuvants) {
          const product = productMap.get(adjuvant.productId);
          if (!product) {
            continue;
          }

          const decrementResult = await tx.product.updateMany({
            where: {
              id: product.id,
              currentStock: { gte: toDecimal(adjuvant.quantityTotal) },
            },
            data: {
              currentStock: { decrement: toDecimal(adjuvant.quantityTotal) },
            },
          });
          if (decrementResult.count !== 1) {
            throw new BusinessLogicError(
              `Le stock du produit ${product.name} a changé pendant l'opération. Rechargez puis recommencez.`,
              409,
            );
          }

          const intrantCode = `INTRANT-PRODUCT-${product.id}`;
          const intrant =
            (await tx.intrant.findUnique({ where: { code: intrantCode } })) ??
            (await tx.intrant.create({
              data: {
                code: intrantCode,
                name: product.name,
                category: product.subCategory,
                mainUnit: product.unit,
              },
            }));

          await tx.lotEventIntrant.create({
            data: {
              eventId: event.id,
              intrantId: intrant.id,
              quantity: toDecimal(adjuvant.quantityTotal),
              unit: adjuvant.quantityUnit,
            },
          });
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              type: 'OUT',
              quantity: toDecimal(adjuvant.quantityTotal),
              note: `Assemblage ${normalized.code} · ${adjuvant.dose} ${adjuvant.doseUnit} sur ${adjuvant.treatedVolumeHl} hL`,
              operator: actor.email,
            },
          });
        }

        await tx.idempotencyRecord.create({
          data: {
            key: normalized.idempotencyKey,
            action: 'ASSEMBLAGE',
            userId: actor.email,
          },
        });
        await tx.auditLog.create({
          data: {
            action: 'ASSEMBLAGE_CREATED',
            details: `Assemblage ${normalized.code} (${decision.suggestedType}) créé avec ${totalVolumeHl.toFixed(2)} hL par ${actor.email}.`,
            userId: actor.email,
          },
        });

        return {
          lot,
          eventId: event.id,
          decision: {
            ...decision,
            requestedType: normalized.assemblageType,
            finalYear,
          },
          destinationContainer: {
            id: destinationContainer.id,
            displayName: destinationContainer.displayName,
            capacity,
          },
          sourceSummary: normalized.sources.map((source) =>
            source.sourceType === 'LOT'
              ? {
                  sourceType: source.sourceType,
                  lotId: source.lotId,
                  volumeHl: source.volumeHl,
                }
              : {
                  sourceType: source.sourceType,
                  bottleLotId: source.bottleLotId,
                  volumeHl: source.volumeHl,
                  bottleCountUsed: source.originQuantity,
                  formatCode: source.formatCode,
                },
          ),
          adjuvants: normalized.adjuvants,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }
}
