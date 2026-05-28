import { Prisma } from '@prisma/client';
import { BusinessLogicError } from '@/lib/errors';
import {
  calculateBottleLotAgeMonths,
  getDegorgementEligibility,
  getExpeditionEligibility,
  getHabillageEligibility,
} from '@/lib/bottles';
import {
  DegorgerInput,
  ExpedierInput,
  HabillerInput,
  UpdateBottleStatusInput,
  ArchiveBottleLotInput,
  CancelBottleEventInput,
} from '@/server/modules/bottles/bottle.schemas';
import { prisma } from '@/server/shared/prisma';

type Tx = Prisma.TransactionClient;

const round = (value: number, precision = 3) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const normalizeText = (value: string | null | undefined) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const ensureValidDate = (value: string, label: string) => {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new BusinessLogicError(`${label} invalide.`, 400);
  }

  return parsedDate;
};

const buildComment = (...parts: Array<string | null | undefined>) =>
  parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');

const isConcurrentBottleConflict = (error: unknown) => {
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

const makeLotCode = async (tx: Tx, prefix: 'DEG' | 'HAB', operationDate: Date, idempotencyKey: string) => {
  const year = operationDate.getUTCFullYear();
  const startsWith = `${prefix}-${year}-`;
  const existingCount = await tx.bottleLot.count({
    where: {
      technicalCode: {
        startsWith,
      },
    },
  });
  const sequence = String(existingCount + 1).padStart(4, '0');
  const publicCode = `${prefix}-${year}-${sequence}`;

  return {
    technicalCode: `${publicCode}-${idempotencyKey.slice(0, 8)}`,
    businessCode: publicCode,
  };
};

const assertPositiveStock = (stock: number, requested: number, message: string) => {
  if (stock < requested) {
    throw new BusinessLogicError(message, 409);
  }
};

const assertSubCategory = (
  product: { name: string; category: string; subCategory: string; unit: string },
  expected: string[],
  message: string,
) => {
  const productSubCategory = normalizeText(product.subCategory);
  if (!expected.some((candidate) => productSubCategory === normalizeText(candidate))) {
    throw new BusinessLogicError(message, 400);
  }
};

const assertLiqueurProduct = (product: { name: string; category: string; subCategory: string; unit: string }) => {
  const category = normalizeText(product.category);
  const subCategory = normalizeText(product.subCategory);
  const name = normalizeText(product.name);

  if (
    category !== 'intrants' &&
    !subCategory.includes('liqueur') &&
    !name.includes('liqueur')
  ) {
    throw new BusinessLogicError(
      `Le produit ${product.name} n'est pas reconnu comme une liqueur de dosage.`,
      400,
    );
  }

  if (!['l', 'litre', 'litres'].includes(normalizeText(product.unit))) {
    throw new BusinessLogicError(
      `Le produit ${product.name} doit être stocké en litres pour la liqueur de dosage.`,
      400,
    );
  }
};

const consumeProduct = async (
  tx: Tx,
  {
    actorEmail,
    productId,
    quantity,
    note,
    validate,
  }: {
    actorEmail: string;
    productId?: number | null;
    quantity: number;
    note: string;
    validate?: (product: { name: string; category: string; subCategory: string; unit: string }) => void;
  },
) => {
  if (!productId || quantity <= 0) {
    return null;
  }

  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw new BusinessLogicError(`Produit introuvable (#${productId}).`, 404);
  }

  validate?.(product);
  assertPositiveStock(
    Number(product.currentStock),
    quantity,
    `Stock insuffisant pour ${product.name}. Disponible: ${Number(product.currentStock).toFixed(3)} ${product.unit}.`,
  );

  const decrementResult = await tx.product.updateMany({
    where: {
      id: product.id,
      currentStock: {
        gte: new Prisma.Decimal(quantity.toFixed(3)),
      },
    },
    data: {
      currentStock: {
        decrement: new Prisma.Decimal(quantity.toFixed(3)),
      },
    },
  });

  if (decrementResult.count !== 1) {
    throw new BusinessLogicError(
      `Le stock du produit ${product.name} a changé pendant l'opération. Rechargez puis réessayez.`,
      409,
    );
  }

  const movement = await tx.stockMovement.create({
    data: {
      productId: product.id,
      type: 'OUT',
      quantity: new Prisma.Decimal(quantity.toFixed(3)),
      note,
      operator: actorEmail,
    },
  });

  return {
    productId: product.id,
    productName: product.name,
    quantity: round(quantity),
    unit: product.unit,
    movementId: movement.id,
  };
};

type JsonObject = Record<string, unknown>;

const asObject = (value: unknown): JsonObject =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};

const asNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const addProductStock = async (
  tx: Tx,
  {
    actorEmail,
    productId,
    quantity,
    note,
  }: {
    actorEmail: string;
    productId: number;
    quantity: number;
    note: string;
  },
) => {
  if (quantity <= 0) {
    return null;
  }

  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product) {
    return null;
  }

  await tx.product.update({
    where: { id: product.id },
    data: {
      currentStock: {
        increment: new Prisma.Decimal(quantity.toFixed(3)),
      },
    },
  });

  const movement = await tx.stockMovement.create({
    data: {
      productId: product.id,
      type: 'IN',
      quantity: new Prisma.Decimal(quantity.toFixed(3)),
      note,
      operator: actorEmail,
    },
  });

  return {
    productId: product.id,
    productName: product.name,
    quantity: round(quantity),
    unit: product.unit,
    movementId: movement.id,
  };
};

export class BottlesService {
  private static async getUserId(tx: Tx, email: string) {
    const user = await tx.user.findUnique({ where: { email } });
    if (!user) {
      throw new BusinessLogicError('Utilisateur non autorisé.', 401);
    }

    return user.id;
  }

  static async updateStatus(data: UpdateBottleStatusInput, userEmail: string) {
    return prisma.$transaction(
      async (tx) => {
        const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
        if (existingTx) {
          throw new BusinessLogicError('Cette opération a déjà été traitée.', 409);
        }

        const bottleLot = await tx.bottleLot.findUnique({ where: { id: data.blId } });
        if (!bottleLot) {
          throw new BusinessLogicError('Lot introuvable.', 404);
        }

        const operatorId = await this.getUserId(tx, userEmail);
        const updated = await tx.bottleLot.update({
          where: { id: data.blId },
          data: {
            status: data.status,
            locationZone: data.location || bottleLot.locationZone,
          },
        });

        const event = await tx.bottleEvent.create({
          data: {
            eventType: data.status,
            operatorUserId: operatorId,
            comment: data.note,
          },
        });

        await tx.bottleEventLink.create({
          data: {
            eventId: event.id,
            bottleLotId: bottleLot.id,
            roleInEvent: 'STATUS_CHANGE',
            bottleCount: bottleLot.currentBottleCount,
          },
        });

        await tx.idempotencyRecord.create({
          data: {
            key: data.idempotencyKey,
            action: 'BOTTLE_STATUS',
            userId: userEmail,
          },
        });
        await tx.auditLog.create({
          data: {
            action: 'BOTTLE_STATUS_UPDATED',
            details: `Lot ${bottleLot.businessCode} passé en ${data.status} par ${userEmail}.`,
            userId: userEmail,
          },
        });

        return { status: 'SUCCESS', updated };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  static async degorger(data: DegorgerInput, userEmail: string) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
          if (existingTx) {
            throw new BusinessLogicError('Ce dégorgement a déjà été traité.', 409);
          }

          const sourceLot = await tx.bottleLot.findUnique({ where: { id: data.blId } });
          if (!sourceLot) {
            throw new BusinessLogicError('Lot bouteille source introuvable.', 404);
          }

          const operatorId = await this.getUserId(tx, userEmail);
          const degorgementDate = ensureValidDate(data.degorgementDate, 'Date de dégorgement');
          const eligibility = getDegorgementEligibility(sourceLot, degorgementDate);

          if (!eligibility.eligible) {
            throw new BusinessLogicError(
              `Le lot ${sourceLot.businessCode} ne peut pas être dégorgé: ${eligibility.reason}.`,
              409,
            );
          }

          const totalSourceDecrease = data.count + data.lossCount;
          assertPositiveStock(
            sourceLot.currentBottleCount,
            totalSourceDecrease,
            `Stock insuffisant sur ${sourceLot.businessCode}. Disponible: ${sourceLot.currentBottleCount} btl, requis: ${totalSourceDecrease} btl.`,
          );

          const decrementResult = await tx.bottleLot.updateMany({
            where: {
              id: sourceLot.id,
              currentBottleCount: {
                gte: totalSourceDecrease,
              },
            },
            data: {
              currentBottleCount: {
                decrement: totalSourceDecrease,
              },
            },
          });
          if (decrementResult.count !== 1) {
            throw new BusinessLogicError(
              "Le stock bouteilles a changé pendant le dégorgement. Rechargez les données puis réessayez.",
              409,
            );
          }

          const remainingSourceCount = sourceLot.currentBottleCount - totalSourceDecrease;
          await tx.bottleLot.update({
            where: { id: sourceLot.id },
            data: {
              status: remainingSourceCount <= 0 ? 'ARCHIVE' : 'SUR_LATTES',
            },
          });

          const code = await makeLotCode(tx, 'DEG', degorgementDate, data.idempotencyKey);
          const destinationLot = await tx.bottleLot.create({
            data: {
              technicalCode: code.technicalCode,
              businessCode: code.businessCode,
              type: 'DEGORGE',
              sourceLotId: sourceLot.sourceLotId,
              sourceBottleLotId: sourceLot.id,
              formatCode: sourceLot.formatCode,
              initialBottleCount: data.count,
              currentBottleCount: data.count,
              status: 'DEGORGE',
              tirageDate: sourceLot.tirageDate,
              degorgementDate,
              dosageValue: new Prisma.Decimal(data.dosageGramsPerLiter.toFixed(3)),
              dosageUnit: 'g/L',
              locationZone: sourceLot.locationZone ?? 'Habillage',
              locationRack: sourceLot.locationRack,
              locationPalette: sourceLot.locationPalette,
            },
          });

          const stockMovements = [];
          for (const stockItem of [
            {
              productId: data.bouchonProductId,
              quantity: data.count,
              note: `Dégorgement ${destinationLot.businessCode} · bouchons expédition`,
              validate: (product: { name: string; category: string; subCategory: string; unit: string }) =>
                assertSubCategory(
                  product,
                  ['Bouchons'],
                  `Le produit ${product.name} n'est pas un bouchon de dégorgement.`,
                ),
            },
            {
              productId: data.museletProductId,
              quantity: data.count,
              note: `Dégorgement ${destinationLot.businessCode} · muselets`,
              validate: (product: { name: string; category: string; subCategory: string; unit: string }) =>
                assertSubCategory(
                  product,
                  ['Muselets'],
                  `Le produit ${product.name} n'est pas un muselet.`,
                ),
            },
            {
              productId: data.liqueurProductId,
              quantity: data.liqueurVolumeLiters ?? 0,
              note: `Dégorgement ${destinationLot.businessCode} · liqueur ${data.liqueurType}`,
              validate: assertLiqueurProduct,
            },
          ]) {
            const movement = await consumeProduct(tx, {
              actorEmail: userEmail,
              productId: stockItem.productId,
              quantity: stockItem.quantity,
              note: stockItem.note,
              validate: stockItem.validate,
            });
            if (movement) {
              stockMovements.push(movement);
            }
          }

          const bottleEvent = await tx.bottleEvent.create({
            data: {
              eventType: 'DEGORGEMENT',
              operatorUserId: operatorId,
              eventDatetime: degorgementDate,
              comment: buildComment(
                `Dégorgement de ${data.count} btl.`,
                `Âge sur lattes: ${calculateBottleLotAgeMonths(sourceLot.tirageDate, degorgementDate)} mois.`,
                `Dosage: ${data.dosageLabel || `${data.dosageGramsPerLiter} g/L`} (${data.dosageGramsPerLiter} g/L).`,
                `Liqueur: ${data.liqueurType}.`,
                data.liqueurVolumeLiters != null && data.liqueurVolumeLiters > 0
                  ? `Volume liqueur: ${data.liqueurVolumeLiters.toFixed(3)} L.`
                  : null,
                data.lossCount > 0 ? `Pertes: ${data.lossCount} btl.` : null,
                data.note ?? null,
              ),
              metadata: {
                operation: 'DEGORGEMENT',
                quantity: data.count,
                losses: data.lossCount,
                dosageGPerL: round(data.dosageGramsPerLiter),
                liqueurType: data.liqueurType,
                liqueurVolumeL: data.liqueurVolumeLiters != null ? round(data.liqueurVolumeLiters) : null,
                sourceBottleLotId: sourceLot.id,
                destinationBottleLotId: destinationLot.id,
                consumables: stockMovements,
                notes: data.note ?? null,
              },
            },
          });

          await tx.bottleEventLink.createMany({
            data: [
              {
                eventId: bottleEvent.id,
                bottleLotId: sourceLot.id,
                roleInEvent: 'SOURCE',
                bottleCount: totalSourceDecrease,
              },
              {
                eventId: bottleEvent.id,
                bottleLotId: destinationLot.id,
                roleInEvent: 'CIBLE',
                bottleCount: data.count,
              },
            ],
          });

          await tx.idempotencyRecord.create({
            data: {
              key: data.idempotencyKey,
              action: 'DEGORGEMENT',
              userId: userEmail,
            },
          });
          await tx.auditLog.create({
            data: {
              action: 'BOTTLE_DEGORGEMENT_EXECUTED',
              details: `Dégorgement ${destinationLot.businessCode} créé depuis ${sourceLot.businessCode}: ${data.count} btl bonnes, ${data.lossCount} pertes, reste source ${remainingSourceCount} btl.`,
              userId: userEmail,
            },
          });

          return {
            status: 'SUCCESS',
            sourceBottleLotId: sourceLot.id,
            sourceBottleLotCode: sourceLot.businessCode,
            sourceRemainingCount: remainingSourceCount,
            destinationBottleLotId: destinationLot.id,
            destinationBottleLotCode: destinationLot.businessCode,
            destinationCount: destinationLot.currentBottleCount,
            destinationStatus: destinationLot.status,
            lossCount: data.lossCount,
            ageMonths: eligibility.ageMonths,
            bottleEventId: bottleEvent.id,
            stockMovements,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isConcurrentBottleConflict(error)) {
        throw new BusinessLogicError(
          'Un autre opérateur a modifié le lot ou un consommable pendant le dégorgement. Rechargez puis réessayez.',
          409,
        );
      }

      throw error;
    }
  }

  static async habiller(data: HabillerInput, userEmail: string) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
          if (existingTx) {
            throw new BusinessLogicError("Cet habillage a déjà été traité.", 409);
          }

          const sourceLot = await tx.bottleLot.findUnique({ where: { id: data.blId } });
          if (!sourceLot) {
            throw new BusinessLogicError('Lot dégorgé introuvable.', 404);
          }

          const operatorId = await this.getUserId(tx, userEmail);
          const habillageDate = ensureValidDate(data.habillageDate, "Date d'habillage");
          const eligibility = getHabillageEligibility(sourceLot);

          if (!eligibility.eligible) {
            throw new BusinessLogicError(
              `Le lot ${sourceLot.businessCode} ne peut pas être habillé: ${eligibility.reason}.`,
              409,
            );
          }

          assertPositiveStock(
            sourceLot.currentBottleCount,
            data.count,
            `Stock insuffisant sur ${sourceLot.businessCode}. Disponible: ${sourceLot.currentBottleCount} btl, requis: ${data.count} btl.`,
          );

          const decrementResult = await tx.bottleLot.updateMany({
            where: {
              id: sourceLot.id,
              currentBottleCount: {
                gte: data.count,
              },
            },
            data: {
              currentBottleCount: {
                decrement: data.count,
              },
            },
          });
          if (decrementResult.count !== 1) {
            throw new BusinessLogicError(
              "Le stock bouteilles a changé pendant l'habillage. Rechargez les données puis réessayez.",
              409,
            );
          }

          const remainingSourceCount = sourceLot.currentBottleCount - data.count;
          await tx.bottleLot.update({
            where: { id: sourceLot.id },
            data: {
              status: remainingSourceCount <= 0 ? 'ARCHIVE' : 'DEGORGE',
            },
          });

          const code = await makeLotCode(tx, 'HAB', habillageDate, data.idempotencyKey);
          const destinationLot = await tx.bottleLot.create({
            data: {
              technicalCode: code.technicalCode,
              businessCode: code.businessCode,
              type: 'HABILLE',
              sourceLotId: sourceLot.sourceLotId,
              sourceBottleLotId: sourceLot.id,
              formatCode: sourceLot.formatCode,
              initialBottleCount: data.count,
              currentBottleCount: data.count,
              status: 'PRET_EXPEDITION',
              tirageDate: sourceLot.tirageDate,
              degorgementDate: sourceLot.degorgementDate,
              dosageValue: sourceLot.dosageValue,
              dosageUnit: sourceLot.dosageUnit,
              locationZone: 'Expédition',
              locationRack: sourceLot.locationRack,
              locationPalette: sourceLot.locationPalette,
            },
          });

          const stockMovements = [];
          for (const stockItem of [
            {
              productId: data.coiffeId,
              quantity: data.count,
              note: `Habillage ${destinationLot.businessCode} · coiffes`,
              validate: (product: { name: string; category: string; subCategory: string; unit: string }) =>
                assertSubCategory(product, ['Coiffes'], `Le produit ${product.name} n'est pas une coiffe.`),
            },
            {
              productId: data.etiquetteId,
              quantity: data.count,
              note: `Habillage ${destinationLot.businessCode} · étiquettes`,
              validate: (product: { name: string; category: string; subCategory: string; unit: string }) =>
                assertSubCategory(product, ['Étiquettes'], `Le produit ${product.name} n'est pas une étiquette.`),
            },
            {
              productId: data.contreEtiquetteId,
              quantity: data.count,
              note: `Habillage ${destinationLot.businessCode} · contre-étiquettes`,
              validate: (product: { name: string; category: string; subCategory: string; unit: string }) =>
                assertSubCategory(
                  product,
                  ['Contre-étiquettes', 'Contre etiquettes'],
                  `Le produit ${product.name} n'est pas une contre-étiquette.`,
                ),
            },
            {
              productId: data.cartonId,
              quantity: Math.ceil(data.count / data.cartonSize),
              note: `Habillage ${destinationLot.businessCode} · cartons x${data.cartonSize}`,
              validate: (product: { name: string; category: string; subCategory: string; unit: string }) =>
                assertSubCategory(product, ['Cartons'], `Le produit ${product.name} n'est pas un carton.`),
            },
          ]) {
            const movement = await consumeProduct(tx, {
              actorEmail: userEmail,
              productId: stockItem.productId,
              quantity: stockItem.quantity,
              note: stockItem.note,
              validate: stockItem.validate,
            });
            if (movement) {
              stockMovements.push(movement);
            }
          }

          const bottleEvent = await tx.bottleEvent.create({
            data: {
              eventType: 'HABILLAGE',
              operatorUserId: operatorId,
              eventDatetime: habillageDate,
              comment: buildComment(
                `Habillage de ${data.count} btl.`,
                data.cartonId ? `Cartonnage ${data.cartonSize}.` : null,
                data.note ?? null,
              ),
              metadata: {
                operation: 'HABILLAGE',
                quantity: data.count,
                sourceBottleLotId: sourceLot.id,
                destinationBottleLotId: destinationLot.id,
                consumables: stockMovements,
                packaging: {
                  cartonSize: data.cartonSize,
                  cartons: data.cartonId ? Math.ceil(data.count / data.cartonSize) : null,
                },
                notes: data.note ?? null,
              },
            },
          });

          await tx.bottleEventLink.createMany({
            data: [
              {
                eventId: bottleEvent.id,
                bottleLotId: sourceLot.id,
                roleInEvent: 'SOURCE',
                bottleCount: data.count,
              },
              {
                eventId: bottleEvent.id,
                bottleLotId: destinationLot.id,
                roleInEvent: 'CIBLE',
                bottleCount: data.count,
              },
            ],
          });

          await tx.idempotencyRecord.create({
            data: {
              key: data.idempotencyKey,
              action: 'HABILLAGE',
              userId: userEmail,
            },
          });
          await tx.auditLog.create({
            data: {
              action: 'BOTTLE_HABILLAGE_EXECUTED',
              details: `Habillage ${destinationLot.businessCode} créé depuis ${sourceLot.businessCode}: ${data.count} btl, reste source ${remainingSourceCount} btl.`,
              userId: userEmail,
            },
          });

          return {
            status: 'SUCCESS',
            sourceBottleLotId: sourceLot.id,
            sourceBottleLotCode: sourceLot.businessCode,
            sourceRemainingCount: remainingSourceCount,
            destinationBottleLotId: destinationLot.id,
            destinationBottleLotCode: destinationLot.businessCode,
            destinationCount: destinationLot.currentBottleCount,
            destinationStatus: destinationLot.status,
            bottleEventId: bottleEvent.id,
            stockMovements,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isConcurrentBottleConflict(error)) {
        throw new BusinessLogicError(
          'Un autre opérateur a modifié le lot ou un consommable pendant l\'habillage. Rechargez puis réessayez.',
          409,
        );
      }

      throw error;
    }
  }

  static async expedier(data: ExpedierInput, userEmail: string) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
          if (existingTx) {
            throw new BusinessLogicError('Cette expédition a déjà été traitée.', 409);
          }

          const sourceLot = await tx.bottleLot.findUnique({ where: { id: data.blId } });
          if (!sourceLot) {
            throw new BusinessLogicError("Lot prêt à l'expédition introuvable.", 404);
          }

          const operatorId = await this.getUserId(tx, userEmail);
          const expeditionDate = ensureValidDate(data.expeditionDate, "Date d'expédition");
          const eligibility = getExpeditionEligibility(sourceLot);
          const destination = data.destination?.trim() || null;
          const note = data.note?.trim() || null;

          if (!eligibility.eligible) {
            throw new BusinessLogicError(
              `Le lot ${sourceLot.businessCode} ne peut pas être expédié: ${eligibility.reason}.`,
              409,
            );
          }

          assertPositiveStock(
            sourceLot.currentBottleCount,
            data.count,
            `Stock insuffisant sur ${sourceLot.businessCode}. Disponible: ${sourceLot.currentBottleCount} btl, requis: ${data.count} btl.`,
          );

          const decrementResult = await tx.bottleLot.updateMany({
            where: {
              id: sourceLot.id,
              currentBottleCount: {
                gte: data.count,
              },
            },
            data: {
              currentBottleCount: {
                decrement: data.count,
              },
            },
          });
          if (decrementResult.count !== 1) {
            throw new BusinessLogicError(
              "Le stock bouteilles a changé pendant l'expédition. Rechargez les données puis réessayez.",
              409,
            );
          }

          const remainingSourceCount = sourceLot.currentBottleCount - data.count;
          await tx.bottleLot.update({
            where: { id: sourceLot.id },
            data: {
              status: remainingSourceCount <= 0 ? 'EXPEDIE' : 'PRET_EXPEDITION',
            },
          });

          const shipment = await tx.shipment.create({
            data: {
              shipmentDate: expeditionDate,
              customerName: data.clientName,
              comment: buildComment(
                destination ? `Destination: ${destination}.` : null,
                note,
              ),
            },
          });
          const shipmentLine = await tx.shipmentLine.create({
            data: {
              shipmentId: shipment.id,
              bottleLotId: sourceLot.id,
              bottleCount: data.count,
            },
          });

          const bottleEvent = await tx.bottleEvent.create({
            data: {
              eventType: 'EXPEDITION',
              operatorUserId: operatorId,
              eventDatetime: expeditionDate,
              comment: buildComment(
                `Expédition de ${data.count} btl vers ${data.clientName}.`,
                destination ? `Destination: ${destination}.` : null,
                note,
              ),
              metadata: {
                operation: 'EXPEDITION',
                quantity: data.count,
                customer: data.clientName,
                destination,
                shipmentId: shipment.id,
                shipmentLineId: shipmentLine.id,
                sourceBottleLotId: sourceLot.id,
                notes: note,
              },
            },
          });
          await tx.bottleEventLink.create({
            data: {
              eventId: bottleEvent.id,
              bottleLotId: sourceLot.id,
              roleInEvent: 'SOURCE',
              bottleCount: data.count,
            },
          });

          await tx.idempotencyRecord.create({
            data: {
              key: data.idempotencyKey,
              action: 'EXPEDITION',
              userId: userEmail,
            },
          });
          await tx.auditLog.create({
            data: {
              action: 'BOTTLE_EXPEDITION_EXECUTED',
              details: `Expédition du lot ${sourceLot.businessCode} vers ${data.clientName}: ${data.count} btl, reste ${remainingSourceCount} btl.`,
              userId: userEmail,
            },
          });

          return {
            status: 'SUCCESS',
            shipmentId: shipment.id,
            sourceBottleLotId: sourceLot.id,
            sourceBottleLotCode: sourceLot.businessCode,
            sourceRemainingCount: remainingSourceCount,
            sourceStatus: remainingSourceCount <= 0 ? 'EXPEDIE' : 'PRET_EXPEDITION',
            bottleEventId: bottleEvent.id,
            shippedCount: data.count,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isConcurrentBottleConflict(error)) {
        throw new BusinessLogicError(
          "Un autre opérateur a modifié le lot pendant l'expédition. Rechargez puis réessayez.",
          409,
        );
      }

      throw error;
    }
  }

  static async archive(data: ArchiveBottleLotInput, userEmail: string) {
    return prisma.$transaction(
      async (tx) => {
        const bottleLot = await tx.bottleLot.findUnique({
          where: { id: data.bottleLotId },
          include: {
            shipmentLines: true,
          },
        });
        if (!bottleLot) {
          throw new BusinessLogicError('Lot bouteille introuvable.', 404);
        }

        if (bottleLot.status === 'ARCHIVE' || bottleLot.archivedAt) {
          throw new BusinessLogicError('Ce lot bouteille est déjà archivé.', 409);
        }

        const [childrenCount, activeExpeditionCount] = await Promise.all([
          tx.bottleLot.count({ where: { sourceBottleLotId: bottleLot.id } }),
          tx.bottleEventLink.count({
            where: {
              bottleLotId: bottleLot.id,
              event: {
                eventType: 'EXPEDITION',
                cancelledAt: null,
              },
            },
          }),
        ]);
        const activeShipmentLines = bottleLot.shipmentLines.filter((line) => !line.cancelledAt);

        if (childrenCount > 0 || activeShipmentLines.length > 0 || activeExpeditionCount > 0) {
          throw new BusinessLogicError(
            'Impossible d’archiver ce lot : il possède des lots enfants ou des expéditions actives. Annule d’abord les opérations aval.',
            409,
          );
        }

        const operatorId = await this.getUserId(tx, userEmail);
        const archivedAt = new Date();
        const updated = await tx.bottleLot.update({
          where: { id: bottleLot.id },
          data: {
            status: 'ARCHIVE',
            archivedAt,
            archivedBy: userEmail,
            archiveReason: data.reason,
          },
        });

        const event = await tx.bottleEvent.create({
          data: {
            eventType: 'ARCHIVAGE',
            operatorUserId: operatorId,
            eventDatetime: archivedAt,
            comment: buildComment(`Archivage du lot ${bottleLot.businessCode}.`, data.reason, data.note ?? null),
            metadata: {
              operation: 'ARCHIVAGE',
              bottleLotId: bottleLot.id,
              previousStatus: bottleLot.status,
              quantity: bottleLot.currentBottleCount,
              reason: data.reason,
              note: data.note ?? null,
            },
          },
        });

        await tx.bottleEventLink.create({
          data: {
            eventId: event.id,
            bottleLotId: bottleLot.id,
            roleInEvent: 'ARCHIVED',
            bottleCount: bottleLot.currentBottleCount,
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'BOTTLE_LOT_ARCHIVED',
            details: `Lot bouteille ${bottleLot.businessCode} archivé par ${userEmail}. Raison: ${data.reason}.`,
            userId: userEmail,
          },
        });

        return {
          status: 'SUCCESS',
          bottleLotId: updated.id,
          bottleLotCode: updated.businessCode,
          archivedAt,
          archiveEventId: event.id,
          warnings: [],
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  static async cancelEvent(data: CancelBottleEventInput, userEmail: string) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const event = await tx.bottleEvent.findUnique({
            where: { id: data.eventId },
            include: {
              links: {
                include: {
                  bottleLot: true,
                },
              },
            },
          });

          if (!event) {
            throw new BusinessLogicError('Événement bouteille introuvable.', 404);
          }
          if (event.cancelledAt) {
            throw new BusinessLogicError('Cet événement bouteille est déjà annulé.', 409);
          }

          if (event.eventType !== 'EXPEDITION') {
            throw new BusinessLogicError(
              `Annulation ${event.eventType} non disponible en V1. Les règles sont préparées, mais seules les expéditions sont restaurées automatiquement pour l’instant.`,
              409,
            );
          }

          const metadata = asObject(event.metadata);
          if (metadata.deliveryStatus === 'LIVRE' || metadata.status === 'LIVREE') {
            throw new BusinessLogicError(
              'Impossible d’annuler une expédition déjà livrée. Utilise une future opération de retour/correction après livraison.',
              409,
            );
          }

          const sourceBottleLotId =
            asNumber(metadata.sourceBottleLotId) ??
            event.links.find((link) => link.roleInEvent === 'SOURCE')?.bottleLotId ??
            null;
          const quantity =
            asNumber(metadata.quantity) ??
            event.links.find((link) => link.roleInEvent === 'SOURCE')?.bottleCount ??
            null;
          const shipmentLineId = asNumber(metadata.shipmentLineId);

          if (!sourceBottleLotId || !quantity || quantity <= 0) {
            throw new BusinessLogicError(
              "Impossible d’annuler cette expédition : les métadonnées sourceBottleLotId/quantity sont incomplètes.",
              409,
            );
          }

          const sourceLot = await tx.bottleLot.findUnique({ where: { id: sourceBottleLotId } });
          if (!sourceLot) {
            throw new BusinessLogicError('Lot bouteille source introuvable pour cette expédition.', 404);
          }
          if (sourceLot.status === 'ARCHIVE') {
            throw new BusinessLogicError(
              'Impossible d’annuler cette expédition : le lot source est archivé.',
              409,
            );
          }

          if (shipmentLineId) {
            const shipmentLine = await tx.shipmentLine.findUnique({ where: { id: shipmentLineId } });
            if (shipmentLine?.cancelledAt) {
              throw new BusinessLogicError('Cette ligne d’expédition est déjà marquée comme annulée.', 409);
            }
          }

          const operatorId = await this.getUserId(tx, userEmail);
          const cancelledAt = new Date();
          const restoredCount = sourceLot.currentBottleCount + quantity;
          const nextStatus = sourceLot.status === 'EXPEDIE' && restoredCount > 0 ? 'PRET_EXPEDITION' : sourceLot.status;

          const updatedLot = await tx.bottleLot.update({
            where: { id: sourceLot.id },
            data: {
              currentBottleCount: {
                increment: quantity,
              },
              status: nextStatus,
            },
          });

          if (shipmentLineId) {
            await tx.shipmentLine.update({
              where: { id: shipmentLineId },
              data: {
                cancelledAt,
                cancelReason: data.reason,
              },
            });
          }

          const cancelEvent = await tx.bottleEvent.create({
            data: {
              eventType: 'ANNULATION_EXPEDITION',
              operatorUserId: operatorId,
              eventDatetime: cancelledAt,
              comment: buildComment(
                `Annulation de l’expédition #${event.id}: ${quantity} btl restaurées sur ${sourceLot.businessCode}.`,
                data.reason,
                data.note ?? null,
              ),
              metadata: {
                operation: 'ANNULATION_EXPEDITION',
                cancelledEventId: event.id,
                quantity,
                sourceBottleLotId: sourceLot.id,
                shipmentId: metadata.shipmentId ?? null,
                shipmentLineId: shipmentLineId ?? null,
                previousBottleLotStatus: sourceLot.status,
                nextBottleLotStatus: nextStatus,
                previousBottleCount: sourceLot.currentBottleCount,
                restoredBottleCount: restoredCount,
                reason: data.reason,
                note: data.note ?? null,
              },
            },
          });

          await tx.bottleEvent.update({
            where: { id: event.id },
            data: {
              cancelledAt,
              cancelledBy: userEmail,
              cancelReason: data.reason,
              cancelEventId: cancelEvent.id,
            },
          });

          await tx.bottleEventLink.create({
            data: {
              eventId: cancelEvent.id,
              bottleLotId: sourceLot.id,
              roleInEvent: 'RESTORED_SOURCE',
              bottleCount: quantity,
            },
          });

          await tx.auditLog.create({
            data: {
              action: 'BOTTLE_EXPEDITION_CANCELLED',
              details: `Expédition #${event.id} annulée par ${userEmail}: ${quantity} btl restaurées sur ${sourceLot.businessCode}. Raison: ${data.reason}.`,
              userId: userEmail,
            },
          });

          return {
            status: 'SUCCESS',
            cancelledEventId: event.id,
            cancelEventId: cancelEvent.id,
            sourceBottleLotId: updatedLot.id,
            sourceBottleLotCode: updatedLot.businessCode,
            restoredCount: quantity,
            sourceBottleCount: updatedLot.currentBottleCount,
            sourceStatus: updatedLot.status,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isConcurrentBottleConflict(error)) {
        throw new BusinessLogicError(
          'Un autre opérateur a modifié le lot pendant l’annulation. Rechargez puis réessayez.',
          409,
        );
      }

      throw error;
    }
  }
}
