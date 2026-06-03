// services/lots.service.ts
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/shared/prisma';
import { 
  AddIntrantSchema, 
  FA_DENSITY_MAX,
  FA_DENSITY_MIN,
  FA_TEMPERATURE_MAX,
  FA_TEMPERATURE_MIN,
  SaveFaTourSchema,
  CreateLotSchema, 
  UpdateLotStatusSchema, 
  UpdateLotVolumeSchema 
} from '../validations/lots.schema';

const isProvided = (value: unknown) => value !== null && value !== undefined && value !== '';

const toFiniteNumber = (value: unknown) => {
  if (!isProvided(value)) return null;
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const toStockDecimal = (value: number) => new Prisma.Decimal(value.toFixed(3));

const normalizeIntrantCodePart = (value: string) => {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'INTRANT';
};

const validateFaTourBusinessRules = (data: z.infer<typeof SaveFaTourSchema>) => {
  if (!data || !Array.isArray(data.readings) || data.readings.length === 0) {
    throw new Error('Aucun relevé à sauvegarder.');
  }

  if (typeof data.idempotencyKey !== 'string' || data.idempotencyKey.trim().length < 10) {
    throw new Error('Clé d’idempotence FA invalide.');
  }

  let hasMeasurement = false;

  data.readings.forEach((reading, index) => {
    const label = `Relevé FA #${index + 1}`;

    if (!reading || !Number.isInteger(reading.lotId) || reading.lotId <= 0) {
      throw new Error(`${label} : lot invalide.`);
    }

    if (typeof reading.date !== 'string' || !reading.date.trim()) {
      throw new Error(`${label} : date obligatoire.`);
    }

    if (isProvided(reading.density)) {
      hasMeasurement = true;
      const density = toFiniteNumber(reading.density);

      if (density === null || density < FA_DENSITY_MIN || density > FA_DENSITY_MAX) {
        throw new Error(`${label} : densité invalide (${FA_DENSITY_MIN}-${FA_DENSITY_MAX}).`);
      }
    }

    if (isProvided(reading.temperature)) {
      hasMeasurement = true;
      const temperature = toFiniteNumber(reading.temperature);

      if (temperature === null || temperature < FA_TEMPERATURE_MIN || temperature > FA_TEMPERATURE_MAX) {
        throw new Error(`${label} : température invalide (${FA_TEMPERATURE_MIN}-${FA_TEMPERATURE_MAX} °C).`);
      }
    }
  });

  if (!hasMeasurement) {
    throw new Error('Aucune donnée valide à enregistrer.');
  }
};

export class LotsService {
  
  // =========================================================================
  // 1. AJOUT INTRANT / OPÉRATION + VERROU AOC
  // =========================================================================
  static async addIntrant(data: z.infer<typeof AddIntrantSchema>, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Opération déjà enregistrée.");

      const lot = await tx.lot.findUnique({ where: { id: data.lotId } });
      if (!lot) throw new Error("Lot introuvable.");

      const isSucre = data.intrant === "Chaptalisation (Sucre)";
      const isAcide = data.intrant === "Acidification";

      if (isSucre || isAcide) {
        const pastEvents = await tx.lotEvent.findMany({
          where: { 
            lots: { some: { lotId: lot.id } },
            eventType: "INTRANT"
          }
        });

        const hasChaptalise = pastEvents.some(e => e.comment?.toLowerCase().includes("sucre") || e.comment?.toLowerCase().includes("chaptalisation"));
        const hasAcidifie = pastEvents.some(e => e.comment?.toLowerCase().includes("acide") || e.comment?.toLowerCase().includes("acidification"));

        if (isSucre && hasAcidifie) throw new Error("AOC: Ce lot a déjà été acidifié. La chaptalisation est interdite.");
        if (isAcide && hasChaptalise) throw new Error("AOC: Ce lot a déjà été chaptalisé. L'acidification est interdite.");
      }

      const user = await tx.user.findUnique({ where: { email: userEmail } });
      const userId = user?.id || 1;
      const quantity = toStockDecimal(data.quantity);
      let product: Awaited<ReturnType<typeof tx.product.findUnique>> | null = null;
      let stockBefore: number | null = null;
      let stockAfter: number | null = null;
      let stockMovementId: number | null = null;

      if (data.productId) {
        product = await tx.product.findUnique({ where: { id: data.productId } });
        if (!product) throw new Error("Produit intrant introuvable.");
        stockBefore = Number(product.currentStock);

        if (stockBefore < data.quantity) {
          throw new Error(`Stock insuffisant pour ${product.name}. Disponible: ${stockBefore.toFixed(3)} ${product.unit}, demandé: ${data.quantity}.`);
        }
      }

      const intrantLabel = product?.name || data.intrant.trim();
      const intrantCode = product
        ? `PRODUCT-${product.id}`
        : `FREE-${normalizeIntrantCodePart(intrantLabel).slice(0, 80)}`;
      const intrantRef = await tx.intrant.upsert({
        where: { code: intrantCode },
        create: {
          code: intrantCode,
          name: intrantLabel,
          category: product?.subCategory || "Process",
          mainUnit: product?.unit || data.unit,
        },
        update: {
          name: intrantLabel,
          category: product?.subCategory || "Process",
          mainUnit: product?.unit || data.unit,
        },
      });

      const event = await tx.lotEvent.create({
        data: {
          eventType: "INTRANT",
          operatorUserId: userId,
          comment: `${intrantLabel} : ${data.quantity} ${data.unit}`,
          metadata: {
            operation: "INTRANT",
            lotId: lot.id,
            intrant: intrantLabel,
            quantity: data.quantity,
            unit: data.unit,
            productId: product?.id ?? null,
            stockMovementId: null,
            stockBefore,
            stockAfter,
            note: data.note || null,
            idempotencyKey: data.idempotencyKey
          }
        }
      });

      await tx.lotEventLot.create({
        data: { eventId: event.id, lotId: lot.id, roleInEvent: "CIBLE", volumeChange: 0 }
      });

      await tx.lotEventIntrant.create({
        data: {
          eventId: event.id,
          intrantId: intrantRef.id,
          quantity,
          unit: data.unit,
        }
      });

      if (product) {
        const decrementResult = await tx.product.updateMany({
          where: {
            id: product.id,
            currentStock: { gte: quantity },
          },
          data: {
            currentStock: { decrement: quantity },
          },
        });

        if (decrementResult.count !== 1) {
          throw new Error("Le stock a changé pendant l'opération. Rechargez les données puis réessayez.");
        }

        stockAfter = stockBefore === null ? null : Number((stockBefore - data.quantity).toFixed(3));
        const movement = await tx.stockMovement.create({
          data: {
            productId: product.id,
            type: "OUT",
            quantity,
            note: data.note || `Intrant lot ${lot.businessCode}: ${intrantLabel}`,
            operator: userEmail,
          },
        });
        stockMovementId = movement.id;

        await tx.lotEvent.update({
          where: { id: event.id },
          data: {
            metadata: {
              operation: "INTRANT",
              lotId: lot.id,
              intrant: intrantLabel,
              quantity: data.quantity,
              unit: data.unit,
              productId: product.id,
              stockMovementId,
              stockBefore,
              stockAfter,
              note: data.note || null,
              idempotencyKey: data.idempotencyKey
            }
          }
        });
      }

      const autoStatusUpdate = false;

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "LOT_INTRANT", userId: userEmail } });

      return {
        status: "SUCCESS",
        autoStatusUpdate,
        eventId: event.id,
        intrantId: intrantRef.id,
        stockMovementId,
        productId: product?.id ?? null,
        stockBefore,
        stockAfter,
      };
    });
  }

  // =========================================================================
  // 2. SAUVEGARDE TOUR FA (AVEC RÈGLE MÉTIER DE FERMETURE)
  // =========================================================================
  static async saveFaTour(data: z.infer<typeof SaveFaTourSchema>, userEmail: string) {
    validateFaTourBusinessRules(data);

    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Relevés déjà enregistrés.");

      const validReadings = data.readings.filter(r => r.density || r.temperature);
      if (validReadings.length === 0) throw new Error("Aucune donnée valide à enregistrer.");

      for (const r of validReadings) {
        await tx.faReading.create({ 
          data: {
            lotId: r.lotId,
            // CORRECTION 1 : Prisma attend un String (YYYY-MM-DD), pas un objet Date
            date: r.date, 
            // CORRECTION 2 : Prisma refuse le 'null'. On force 0 si la valeur manque 
            // ou on utilise une valeur par défaut.
            density: r.density !== null && r.density !== undefined ? parseFloat(r.density.toString()) : 0,
            temperature: r.temperature !== null && r.temperature !== undefined ? parseFloat(r.temperature.toString()) : 0,
            operator: userEmail
          }
        });

        // RÈGLE MÉTIER : Fin de FA => lot inactif mais consultable (VIN_DE_BASE)
        if (r.density && parseFloat(r.density.toString()) <= 995) {
            await tx.lot.update({
                where: { id: r.lotId },
                data: { status: 'VIN_DE_BASE' }
            });
        }
      }

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "TOUR_FA", userId: userEmail } });

      return { status: "SUCCESS", count: validReadings.length };
    });
  }

  // =========================================================================
  // 3. CRÉATION D'UN LOT INITIAL
  // =========================================================================
  static async createLot(data: z.infer<typeof CreateLotSchema>, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Lot déjà créé.");

      const container = await tx.container.findUnique({ where: { id: data.containerId }, include: { currentLots: true } });
      if (!container) throw new Error("Cuve introuvable.");

      const currentVol = container.currentLots?.reduce((sum, l) => sum + Number(l.currentVolume), 0) || 0;
      
      if (currentVol + data.volume > Number(container.capacityValue)) {
        throw new Error(`Débordement ! La cuve ne peut pas accueillir ${data.volume} hL supplémentaires.`);
      }

      const newLot = await tx.lot.create({
        data: {
          technicalCode: `${data.code}-${Date.now().toString().slice(-4)}`,
          businessCode: data.code,
          year: typeof data.millesime === 'number' ? data.millesime : parseInt(data.millesime.toString()),
          mainGrapeCode: data.cepage,
          placeCode: data.lieu,
          sequenceNumber: 1, 
          currentVolume: data.volume,
          currentContainerId: data.containerId,
          status: 'ACTIF'
        }
      });

      await tx.container.update({ where: { id: data.containerId }, data: { status: 'PLEIN' } });

      const user = await tx.user.findUnique({ where: { email: userEmail } });
      const event = await tx.lotEvent.create({
        data: {
          eventType: 'CREATION',
          operatorUserId: user?.id || 1, 
          comment: data.notes || 'Création initiale du lot',
        }
      });

      await tx.lotEventLot.create({ data: { eventId: event.id, lotId: newLot.id, roleInEvent: 'CIBLE', volumeChange: data.volume } });
      await tx.lotEventContainer.create({ data: { eventId: event.id, containerId: data.containerId, roleInEvent: 'CIBLE' } });
      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "CREATE_LOT", userId: userEmail } });

      return { status: "SUCCESS", lot: newLot };
    });
  }

  // 2. CHANGEMENT DE STATUT
  static async updateStatus(data: z.infer<typeof UpdateLotStatusSchema>, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Statut déjà modifié.");

      await tx.lot.update({ where: { id: data.lotId }, data: { status: data.newStatus } });

      const user = await tx.user.findUnique({ where: { email: userEmail } });
      const event = await tx.lotEvent.create({
        data: {
          eventType: 'CHANGEMENT_STATUT',
          operatorUserId: user?.id || 1,
          comment: `Nouveau statut : ${data.newStatus.replace(/_/g, " ")}${data.note ? ' - ' + data.note : ''}`,
        }
      });

      await tx.lotEventLot.create({ data: { eventId: event.id, lotId: data.lotId, roleInEvent: 'CIBLE', volumeChange: 0 } });
      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "UPDATE_STATUS", userId: userEmail } });

      return { status: "SUCCESS" };
    });
  }

  // 3. CORRECTION DU VOLUME
  static async updateVolume(data: z.infer<typeof UpdateLotVolumeSchema>, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Volume déjà corrigé.");

      const lot = await tx.lot.findUnique({ where: { id: data.lotId } });
      if (!lot) throw new Error("Lot introuvable.");

      const diff = data.newVolume - Number(lot.currentVolume);
      const eventType = diff > 0 ? 'CORRECTION_HAUSSE' : 'CORRECTION_BAISSE';

      const updatedLot = await tx.lot.update({ where: { id: data.lotId }, data: { currentVolume: data.newVolume } });

      const user = await tx.user.findUnique({ where: { email: userEmail } });
      const event = await tx.lotEvent.create({
        data: {
          eventType: eventType,
          operatorUserId: user?.id || 1,
          comment: `Ancien vol: ${lot.currentVolume} hL -> Nouveau vol: ${data.newVolume} hL. ${data.note ? '(' + data.note + ')' : ''}`
        }
      });

      await tx.lotEventLot.create({ data: { eventId: event.id, lotId: updatedLot.id, roleInEvent: 'CIBLE', volumeChange: Math.abs(diff) } });
      if (updatedLot.currentContainerId) {
        await tx.lotEventContainer.create({ data: { eventId: event.id, containerId: updatedLot.currentContainerId, roleInEvent: 'CIBLE' } });
      }

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "UPDATE_VOLUME", userId: userEmail } });

      return { status: "SUCCESS" };
    });
  }
}
