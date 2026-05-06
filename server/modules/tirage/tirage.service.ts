import { Prisma } from '@prisma/client';
import {
  calculateAdjuvantQuantity,
  calculateConsumedVolumeHl,
  calculateLevainVolume,
  calculatePackagingNeeds,
  calculateSugarDose,
  calculateTiragePlan,
  calculateYeastQuantity,
  isTirageEligibleLotStatus,
  normalizeTirageBouchage,
} from '@/lib/tirage';
import { BusinessLogicError } from '@/lib/errors';
import { CreateTirageInput } from '@/server/modules/tirage/tirage.schemas';
import { TirageRepository } from '@/server/modules/tirage/tirage.repository';
import { RequestActor } from '@/server/shared/request-context';

interface TirageResult {
  bottleLotId: number;
  bottleLotCode: string;
  remainingVolume: number;
  consumedVolume: number;
  bottleCount: number;
  depletedSourceLot: boolean;
}

const toDecimal = (value: number) => new Prisma.Decimal(value.toFixed(3));
const toNumber = (value: Prisma.Decimal | number) => Number(value);
const subtractDecimals = (left: Prisma.Decimal | number, right: Prisma.Decimal | number) =>
  new Prisma.Decimal(left).minus(new Prisma.Decimal(right));
const normalizeUnit = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .replace('litres', 'l')
    .replace('litre', 'l')
    .replace('millilitres', 'ml')
    .replace('millilitre', 'ml')
    .replace('grammes', 'g')
    .replace('gramme', 'g')
    .replace('kilogrammes', 'kg')
    .replace('kilogramme', 'kg')
    .replace('unités', 'unites')
    .replace('unité', 'unites');
const quantitiesMatch = (left: number, right: number, tolerance = 0.02) =>
  Math.abs(left - right) <= tolerance;

const round = (value: number, precision = 3) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const inferStockKind = (
  product: { subCategory: string; name: string } | undefined,
  fallbackKind: string | null | undefined,
) => {
  if (fallbackKind) {
    return fallbackKind;
  }
  if (!product) {
    return null;
  }

  const subCategory = product.subCategory.trim().toLowerCase();
  const name = product.name.trim().toLowerCase();

  if (subCategory === 'bouteilles') return 'PACKAGING_BOTTLE';
  if (subCategory === 'capsules' || subCategory === 'bouchons') return 'PACKAGING_PRIMARY_CLOSURE';
  if (subCategory === 'bidules' || subCategory === 'agrafes') return 'PACKAGING_SECONDARY_CLOSURE';
  if (subCategory === 'sucres') return 'SUGAR';
  if (subCategory === 'levures') return name.includes('levain') ? 'LEVAIN' : 'YEAST';
  if (subCategory === 'adjuvants') return 'ADJUVANT';
  return null;
};

const serializeTirageItem = (item: CreateTirageInput['stockItems'][number] | CreateTirageInput['calculatedItems'][number]) => ({
  productId: item.productId ?? null,
  kind: item.kind ?? null,
  quantity: item.quantity,
  unit: item.unit,
  label: item.label,
  dose: item.dose ?? null,
  doseUnit: item.doseUnit ?? null,
  treatedVolumeHl: item.treatedVolumeHl ?? null,
  consumeStock: item.consumeStock ?? true,
});

const isConcurrentTirageConflict = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2034' || error.code === 'P2002';
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('write conflict') ||
    message.includes('deadlock') ||
    message.includes('could not serialize access') ||
    message.includes('transaction failed due to a write conflict')
  );
};

export class TirageModuleService {
  static async execute(input: CreateTirageInput, actor: RequestActor): Promise<TirageResult> {
    try {
      return await TirageRepository.withTransaction(async (tx) => {
        const existingRequest = await TirageRepository.findIdempotencyRecord(tx, input.idempotencyKey);
        if (existingRequest) {
          throw new BusinessLogicError('Cette requête de tirage a déjà été traitée.', 409);
        }

        const operator = await TirageRepository.findUserByEmail(tx, actor.email);
        if (!operator) {
          throw new BusinessLogicError('Utilisateur opérateur introuvable.', 401);
        }

        const sourceLot = await TirageRepository.findSourceLot(tx, input.lotId);
        if (!sourceLot) {
          throw new BusinessLogicError('Lot source introuvable.', 404);
        }

        if (!isTirageEligibleLotStatus(sourceLot.status)) {
          throw new BusinessLogicError(
            `Le lot ${sourceLot.businessCode} n'est pas éligible au tirage car son statut est ${sourceLot.status}.`,
            409,
          );
        }

        if (
          input.sourceContainerId != null &&
          input.sourceContainerId !== (sourceLot.currentContainer?.id ?? null)
        ) {
          throw new BusinessLogicError(
            `Le lot ${sourceLot.businessCode} n'est plus dans le contenant attendu pour le tirage.`,
            409,
          );
        }

        const tiragePlan = calculateTiragePlan({
          requestedVolumeHl: input.volume,
          formatCode: input.format,
        });
        if (tiragePlan.bottleCount !== input.count) {
          throw new BusinessLogicError(
            `Le lot ${sourceLot.businessCode} doit produire ${tiragePlan.bottleCount} bouteilles pour ${input.volume} hL au format ${input.format}.`,
            400,
          );
        }

        const consumedVolume = calculateConsumedVolumeHl(input.count, input.format);
        if (consumedVolume <= 0) {
          throw new BusinessLogicError('Le volume consommé calculé pour ce tirage est invalide.', 400);
        }

        const latestAnalysis = sourceLot.analyses[0];
        const residualSugarFromAnalysis =
          latestAnalysis?.extraData &&
          typeof latestAnalysis.extraData === 'object' &&
          !Array.isArray(latestAnalysis.extraData)
            ? Number((latestAnalysis.extraData as Record<string, unknown>).sucresResiduel ?? 0)
            : null;
        const effectiveResidualSugar =
          input.residualSugarGPerL ?? (Number.isFinite(residualSugarFromAnalysis) ? residualSugarFromAnalysis : null);

        if (input.stockItems.length === 0) {
          throw new BusinessLogicError(
            "Aucun stock de tirage n'a ete transmis. Les consommables doivent etre valides cote front puis reverifies cote backend.",
            400,
          );
        }

        const sourceVolume = toNumber(sourceLot.currentVolume);
        if (sourceVolume < consumedVolume) {
          throw new BusinessLogicError(
            `Volume insuffisant dans le lot source. Disponible: ${sourceVolume.toFixed(3)} hL, requis: ${consumedVolume.toFixed(3)} hL.`,
            409,
          );
        }

        const products = await TirageRepository.findProductsByIds(
          tx,
          input.stockItems.map((item) => item.productId),
        );
        const productMap = new Map(products.map((product) => [product.id, product] as const));
        const normalizedBouchage = normalizeTirageBouchage(input.bouchage);
        const expectedPackaging = calculatePackagingNeeds({
          bottleCount: input.count,
          bouchage: normalizedBouchage,
        });
        const stockItemByProductId = new Map(input.stockItems.map((item) => [item.productId, item] as const));
        const packagingKinds = {
          bottle: 'PACKAGING_BOTTLE',
          primary: 'PACKAGING_PRIMARY_CLOSURE',
          secondary: 'PACKAGING_SECONDARY_CLOSURE',
        } as const;

        const packagingState = {
          bottle: false,
          primary: false,
          secondary: false,
        };

        for (const stockItem of input.stockItems) {
          const product = productMap.get(stockItem.productId);
          if (!product) {
            throw new BusinessLogicError(`Produit de tirage introuvable (#${stockItem.productId}).`, 404);
          }
          if (product.unit !== stockItem.unit) {
            throw new BusinessLogicError(
              `Unité incompatible pour ${product.name}. Stock en ${product.unit}, quantité calculée en ${stockItem.unit}.`,
              400,
            );
          }
          if (toNumber(product.currentStock) < stockItem.quantity) {
            throw new BusinessLogicError(
              `Stock insuffisant pour ${product.name}. Disponible: ${toNumber(product.currentStock).toFixed(3)} ${product.unit}.`,
              409,
            );
          }

          const inferredKind = inferStockKind(product, stockItem.kind);
          if (inferredKind === packagingKinds.bottle) {
            packagingState.bottle = true;
            if (!quantitiesMatch(stockItem.quantity, expectedPackaging.bottleQuantity, 0.001)) {
              throw new BusinessLogicError(
                `La quantité de bouteilles doit être de ${expectedPackaging.bottleQuantity} unités pour ce tirage.`,
                400,
              );
            }
          }

          if (inferredKind === packagingKinds.primary) {
            packagingState.primary = true;
            const expectedSubCategory = normalizedBouchage === 'CAPSULE' ? 'capsules' : 'bouchons';
            if (product.subCategory.trim().toLowerCase() !== expectedSubCategory) {
              throw new BusinessLogicError(
                normalizedBouchage === 'CAPSULE'
                  ? 'Le tirage capsule doit consommer des capsules et pas des bouchons liège.'
                  : 'Le tirage liège doit consommer des bouchons liège et pas des capsules.',
                400,
              );
            }
            if (!quantitiesMatch(stockItem.quantity, expectedPackaging.primaryClosureQuantity, 0.001)) {
              throw new BusinessLogicError(
                `La quantité de ${product.name} doit être de ${expectedPackaging.primaryClosureQuantity} unités pour ce tirage.`,
                400,
              );
            }
          }

          if (inferredKind === packagingKinds.secondary) {
            packagingState.secondary = true;
            const expectedSubCategory = normalizedBouchage === 'CAPSULE' ? 'bidules' : 'agrafes';
            if (product.subCategory.trim().toLowerCase() !== expectedSubCategory) {
              throw new BusinessLogicError(
                normalizedBouchage === 'CAPSULE'
                  ? 'Le tirage capsule doit consommer des bidules et pas des agrafes.'
                  : 'Le tirage liège doit consommer des agrafes et pas des bidules.',
                400,
              );
            }
            if (!quantitiesMatch(stockItem.quantity, expectedPackaging.secondaryClosureQuantity, 0.001)) {
              throw new BusinessLogicError(
                `La quantité de ${product.name} doit être de ${expectedPackaging.secondaryClosureQuantity} unités pour ce tirage.`,
                400,
              );
            }
          }
        }

        if (!packagingState.bottle || !packagingState.primary || !packagingState.secondary) {
          throw new BusinessLogicError(
            "Le tirage doit consommer les trois familles d'emballages attendues: bouteilles, bouchage principal et bouchage secondaire.",
            400,
          );
        }

        for (const calculatedItem of input.calculatedItems) {
          const linkedProduct = calculatedItem.productId != null ? productMap.get(calculatedItem.productId) : undefined;
          const matchingStockItem =
            calculatedItem.consumeStock && calculatedItem.productId != null
              ? stockItemByProductId.get(calculatedItem.productId)
              : null;

          if (calculatedItem.consumeStock && !matchingStockItem) {
            throw new BusinessLogicError(
              `L'intrant ${calculatedItem.label} a été calculé mais n'est pas présent dans les stockItems transmis.`,
              400,
            );
          }

          if (calculatedItem.kind === 'PACKAGING_BOTTLE') {
            if (!quantitiesMatch(calculatedItem.quantity, expectedPackaging.bottleQuantity, 0.001)) {
              throw new BusinessLogicError(
                `Le calcul d'emballage pour ${calculatedItem.label} est incohérent avec le nombre de bouteilles attendu.`,
                400,
              );
            }
          }

          if (calculatedItem.kind === 'PACKAGING_PRIMARY_CLOSURE') {
            if (!quantitiesMatch(calculatedItem.quantity, expectedPackaging.primaryClosureQuantity, 0.001)) {
              throw new BusinessLogicError(
                `Le calcul de bouchage principal pour ${calculatedItem.label} est incohérent.`,
                400,
              );
            }
          }

          if (calculatedItem.kind === 'PACKAGING_SECONDARY_CLOSURE') {
            if (!quantitiesMatch(calculatedItem.quantity, expectedPackaging.secondaryClosureQuantity, 0.001)) {
              throw new BusinessLogicError(
                `Le calcul de bouchage secondaire pour ${calculatedItem.label} est incohérent.`,
                400,
              );
            }
          }

          if (calculatedItem.kind === 'SUGAR') {
            if (input.pressureTargetBars == null) {
              throw new BusinessLogicError(
                "La pression cible est requise pour vérifier le sucre de tirage transmis par la planification.",
                400,
              );
            }
            const expectedSugar = calculateSugarDose({
              volumeHl: input.volume,
              targetPressureBars: input.pressureTargetBars,
              residualSugarGPerL: effectiveResidualSugar ?? 0,
              quantityUnit: linkedProduct?.unit ?? calculatedItem.unit,
            });
            if (!quantitiesMatch(calculatedItem.quantity, expectedSugar.quantityTotal)) {
              throw new BusinessLogicError(
                `Le sucre de tirage calculé (${calculatedItem.quantity} ${calculatedItem.unit}) est incohérent. Attendu: ${expectedSugar.quantityTotal.toFixed(3)} ${expectedSugar.quantityUnit}.`,
                400,
              );
            }
            if (calculatedItem.dose != null && !quantitiesMatch(calculatedItem.dose, expectedSugar.additionDoseGPerL, 0.05)) {
              throw new BusinessLogicError(
                `La dose de sucre de tirage (${calculatedItem.dose} g/L) est incohérente. Attendu: ${expectedSugar.additionDoseGPerL.toFixed(3)} g/L.`,
                400,
              );
            }
          }

          if (calculatedItem.kind === 'YEAST') {
            if (calculatedItem.dose == null || !calculatedItem.doseUnit) {
              throw new BusinessLogicError(
                `La dose levure doit être transmise pour ${calculatedItem.label}.`,
                400,
              );
            }
            const expectedQuantity = calculateYeastQuantity({
              treatedVolumeHl: calculatedItem.treatedVolumeHl ?? input.volume,
              dose: calculatedItem.dose,
              doseUnit: calculatedItem.doseUnit,
              quantityUnit: linkedProduct?.unit ?? calculatedItem.unit,
            });
            if (!expectedQuantity || !quantitiesMatch(calculatedItem.quantity, expectedQuantity)) {
              throw new BusinessLogicError(
                `La quantité de levure calculée pour ${calculatedItem.label} est incohérente.`,
                400,
              );
            }
          }

          if (calculatedItem.kind === 'ADJUVANT') {
            if (calculatedItem.dose == null || !calculatedItem.doseUnit) {
              throw new BusinessLogicError(
                `La dose adjuvant doit être transmise pour ${calculatedItem.label}.`,
                400,
              );
            }
            const expectedQuantity = calculateAdjuvantQuantity({
              treatedVolumeHl: calculatedItem.treatedVolumeHl ?? input.volume,
              dose: calculatedItem.dose,
              doseUnit: calculatedItem.doseUnit,
              quantityUnit: linkedProduct?.unit ?? calculatedItem.unit,
            });
            if (!expectedQuantity || !quantitiesMatch(calculatedItem.quantity, expectedQuantity)) {
              throw new BusinessLogicError(
                `La quantité d'adjuvant calculée pour ${calculatedItem.label} est incohérente.`,
                400,
              );
            }
          }

          if (calculatedItem.kind === 'LEVAIN') {
            if (calculatedItem.dose == null) {
              throw new BusinessLogicError(
                `Le pourcentage de levain doit être transmis pour ${calculatedItem.label}.`,
                400,
              );
            }
            const expectedLevainVolume = calculateLevainVolume(
              calculatedItem.treatedVolumeHl ?? input.volume,
              calculatedItem.dose,
            );
            if (!quantitiesMatch(calculatedItem.quantity, expectedLevainVolume)) {
              throw new BusinessLogicError(
                `Le volume de levain calculé pour ${calculatedItem.label} est incohérent.`,
                400,
              );
            }
          }

          if (matchingStockItem) {
            if (normalizeUnit(matchingStockItem.unit) !== normalizeUnit(calculatedItem.unit)) {
              throw new BusinessLogicError(
                `L'unité de ${calculatedItem.label} ne correspond pas entre la planification et le stock transmis.`,
                400,
              );
            }
            if (!quantitiesMatch(matchingStockItem.quantity, calculatedItem.quantity)) {
              throw new BusinessLogicError(
                `La quantité de ${calculatedItem.label} ne correspond pas entre la planification et le stock transmis.`,
                400,
              );
            }
          }
        }

        const decrementResult = await TirageRepository.decrementSourceLot(
          tx,
          sourceLot.id,
          toDecimal(consumedVolume),
        );
        if (decrementResult.count !== 1) {
          throw new BusinessLogicError(
            "Le volume source a changé pendant l'opération. Rechargez les données puis réessayez.",
            409,
          );
        }

        const remainingVolume = round(
          toNumber(subtractDecimals(sourceLot.currentVolume, toDecimal(consumedVolume))),
        );
        const depletedSourceLot = remainingVolume <= 0.0001;
        if (depletedSourceLot) {
          await TirageRepository.updateSourceLotForTirage(tx, sourceLot.id, {
            status: 'TIRE',
            currentContainerId: null,
          });
        }

        const tirageDate = new Date(input.tirageDate);
        const tirageYear = tirageDate.getUTCFullYear();
        const typeCode = input.isTranquille ? 'MISE' : 'TIRAGE';
        const targetStatus = input.isTranquille ? 'EN_CAVE' : 'SUR_LATTES';
        const nextSequence = await TirageRepository.countBottleLotsByTypeAndYear(tx, typeCode, tirageYear);
        const code = `${typeCode}-${tirageYear}-${String(nextSequence + 1).padStart(4, '0')}`;

        const bottleLot = await TirageRepository.createBottleLot(tx, {
          technicalCode: `${code}-${input.idempotencyKey.slice(0, 8)}`,
          businessCode: code,
          type: typeCode,
          sourceLotId: sourceLot.id,
          formatCode: input.format,
          initialBottleCount: input.count,
          currentBottleCount: input.count,
          status: targetStatus,
          tirageDate,
          locationZone: input.zone ?? null,
        });

        const lotEvent = await TirageRepository.createLotEvent(tx, {
          operatorUserId: operator.id,
          eventType: typeCode,
          eventDatetime: tirageDate,
          comment: [
            `${typeCode}: ${input.count} bouteilles au format ${input.format}.`,
            `Volume demandé: ${input.volume.toFixed(3)} hL.`,
            `Volume consommé réel: ${consumedVolume.toFixed(3)} hL.`,
            tiragePlan.remainderVolumeHl > 0
              ? `Reliquat théorique: ${tiragePlan.remainderVolumeHl.toFixed(3)} hL.`
              : null,
            input.planningMeta?.source ? `Source flux: ${input.planningMeta.source}.` : null,
            input.pressureTargetBars != null ? `Pression cible: ${input.pressureTargetBars} bar.` : null,
            input.wineTemperatureC != null ? `Température vin: ${input.wineTemperatureC} °C.` : null,
            effectiveResidualSugar != null
              ? `Sucres résiduels: ${effectiveResidualSugar.toString()} g/L.`
              : null,
            input.note ?? null,
          ]
            .filter(Boolean)
            .join(' '),
        });

        await TirageRepository.createLotEventLink(tx, {
          eventId: lotEvent.id,
          lotId: sourceLot.id,
          roleInEvent: 'SOURCE',
          volumeChange: toDecimal(consumedVolume),
        });

        if (sourceLot.currentContainer?.id) {
          await TirageRepository.createLotEventContainerLink(tx, {
            eventId: lotEvent.id,
            containerId: sourceLot.currentContainer.id,
            roleInEvent: 'SOURCE',
          });
        }

        const bottleEvent = await TirageRepository.createBottleEvent(tx, {
          operatorUserId: operator.id,
          eventType: input.isTranquille ? 'CREATION_MISE' : 'CREATION_TIRAGE',
          eventDatetime: tirageDate,
          comment: input.note ?? (input.isTranquille ? 'Mise en bouteille vin tranquille' : 'Tirage initial'),
          metadata: {
            operation: 'TIRAGE',
            sourceLotId: sourceLot.id,
            sourceContainerId: sourceLot.currentContainer?.id ?? input.sourceContainerId ?? null,
            quantity: input.count,
            format: input.format,
            bottleCount: input.count,
            requestedVolumeHl: input.volume,
            consumedVolumeHl: round(consumedVolume, 4),
            pressureTargetBars: input.pressureTargetBars ?? null,
            wineTemperatureC: input.wineTemperatureC ?? null,
            residualSugarGPerL: effectiveResidualSugar != null ? Number(effectiveResidualSugar) : null,
            bouchage: normalizedBouchage,
            stockItems: input.stockItems.map(serializeTirageItem),
            calculatedItems: input.calculatedItems.map(serializeTirageItem),
            notes: input.note ?? null,
          },
        });

        await TirageRepository.createBottleEventLink(tx, {
          eventId: bottleEvent.id,
          bottleLotId: bottleLot.id,
          roleInEvent: 'CIBLE',
          bottleCount: input.count,
        });

        for (const stockItem of input.stockItems) {
          const product = productMap.get(stockItem.productId);
          if (!product) {
            continue;
          }

          const stockDecrement = await TirageRepository.decrementProductStock(
            tx,
            product.id,
            toDecimal(stockItem.quantity),
          );
          if (stockDecrement.count !== 1) {
            throw new BusinessLogicError(
              `Le stock du produit ${product.name} a changé pendant l'opération. Rechargez puis recommencez.`,
              409,
            );
          }

          const intrantCode = `INTRANT-PRODUCT-${product.id}`;
          const intrant =
            (await TirageRepository.findIntrantByCode(tx, intrantCode)) ??
            (await TirageRepository.createIntrant(tx, {
              code: intrantCode,
              name: product.name,
              category: product.subCategory,
              mainUnit: product.unit,
            }));

          await TirageRepository.createLotEventIntrant(tx, {
            eventId: lotEvent.id,
            intrantId: intrant.id,
            quantity: toDecimal(stockItem.quantity),
            unit: stockItem.unit,
          });
          await TirageRepository.createStockMovement(tx, {
            productId: product.id,
            type: 'OUT',
            quantity: toDecimal(stockItem.quantity),
            note: `Tirage ${code} · ${stockItem.label}${stockItem.dose != null && stockItem.doseUnit ? ` · ${stockItem.dose} ${stockItem.doseUnit}` : ''}`,
            operator: actor.email,
          });
        }

        for (const calculatedItem of input.calculatedItems.filter((item) => item.consumeStock === false)) {
          const intrantCode = `INTRANT-PROCESS-${calculatedItem.kind}`;
          const intrant =
            (await TirageRepository.findIntrantByCode(tx, intrantCode)) ??
            (await TirageRepository.createIntrant(tx, {
              code: intrantCode,
              name: calculatedItem.label,
              category: calculatedItem.kind,
              mainUnit: calculatedItem.unit,
            }));

          await TirageRepository.createLotEventIntrant(tx, {
            eventId: lotEvent.id,
            intrantId: intrant.id,
            quantity: toDecimal(calculatedItem.quantity),
            unit: calculatedItem.unit,
          });
        }

        if (depletedSourceLot && sourceLot.currentContainer?.id) {
          const remainingLotsInContainer = await TirageRepository.countActiveLotsInContainer(
            tx,
            sourceLot.currentContainer.id,
          );
          if (remainingLotsInContainer === 0) {
            await TirageRepository.updateContainerStatus(tx, sourceLot.currentContainer.id, 'VIDE');
          }
        }

        await TirageRepository.createIdempotencyRecord(tx, input.idempotencyKey, actor.email);
        await TirageRepository.createAuditLog(tx, {
          action: 'TIRAGE_EXECUTED',
          details: `Tirage ${bottleLot.businessCode} créé à partir du lot ${sourceLot.businessCode} (${consumedVolume.toFixed(3)} hL consommés) par ${actor.email}.`,
          userId: actor.email,
        });

        return {
          bottleLotId: bottleLot.id,
          bottleLotCode: bottleLot.businessCode,
          remainingVolume: round(Math.max(remainingVolume, 0)),
          consumedVolume: round(consumedVolume),
          bottleCount: input.count,
          depletedSourceLot,
        };
      });
    } catch (error) {
      if (isConcurrentTirageConflict(error)) {
        throw new BusinessLogicError(
          'Un autre tirage a modifié ce lot ou ce stock en parallèle. Rechargez les données puis réessayez.',
          409,
        );
      }

      throw error;
    }
  }
}
