// services/bottles.service.ts
import { Prisma } from '@prisma/client';
import { UpdateBottleStatusSchema, DegorgerSchema, HabillerSchema, ExpedierSchema } from '../validations/bottles.schema';
import { z } from 'zod';
import { prisma } from '@/server/shared/prisma';


export class BottlesService {
  
  // Fonction utilitaire pour récupérer l'ID utilisateur (sécurité)
  private static async getUserId(tx: Prisma.TransactionClient, email: string) {
    const user = await tx.user.findUnique({ where: { email } });
    if (!user) throw new Error("Utilisateur non autorisé.");
    return user.id;
  }

  // =========================================================================
  // 1. CHANGEMENT DE STATUT (Remuage / Pointes)
  // =========================================================================
  static async updateStatus(data: z.infer<typeof UpdateBottleStatusSchema>, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Opération déjà effectuée.");

      const bottleLot = await tx.bottleLot.findUnique({ where: { id: data.blId } });
      if (!bottleLot) throw new Error("Lot introuvable.");

      const operatorId = await this.getUserId(tx, userEmail);

      const updated = await tx.bottleLot.update({
        where: { id: data.blId },
        data: { status: data.status, locationZone: data.location || bottleLot.locationZone }
      });

      const event = await tx.bottleEvent.create({
        data: { eventType: data.status, operatorUserId: operatorId, comment: data.note }
      });

      await tx.bottleEventLink.create({
        data: { eventId: event.id, bottleLotId: bottleLot.id, roleInEvent: "STATUS_CHANGE", bottleCount: bottleLot.currentBottleCount }
      });

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "BOTTLE_STATUS", userId: userEmail } });
      return { status: "SUCCESS", updated };
    });
  }

  // =========================================================================
  // 2. DÉGORGEMENT (Création du lot "Bouteilles Nues")
  // =========================================================================
  static async degorger(data: z.infer<typeof DegorgerSchema>, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Dégorgement déjà enregistré.");

      const sourceLot = await tx.bottleLot.findUnique({ where: { id: data.blId } });
      if (!sourceLot || sourceLot.currentBottleCount < data.count) throw new Error("Stock sur lattes insuffisant.");

      const operatorId = await this.getUserId(tx, userEmail);

      // 1. Déduire du lot d'origine
      const newCount = sourceLot.currentBottleCount - data.count;
      await tx.bottleLot.update({
        where: { id: sourceLot.id },
        data: { 
          currentBottleCount: newCount,
          status: newCount <= 0 ? 'DEGORGE_TOTALEMENT' : sourceLot.status
        }
      });

      // 2. Créer le lot dégorgé
      let dosageValue = 0;
      const match = data.dosage.match(/(\d+(?:\.\d+)?) g\/L/);
      if (match) dosageValue = parseFloat(match[1]);

      const targetCode = `${sourceLot.businessCode.replace('-TIR', '')}-DEG${data.suffix}-${Date.now().toString().slice(-4)}`;
      
      const newLot = await tx.bottleLot.create({
        data: {
          technicalCode: `DEG-${Date.now()}`,
          businessCode: targetCode,
          type: "DEGORGE",
          sourceLotId: sourceLot.sourceLotId,
          sourceBottleLotId: sourceLot.id,
          formatCode: sourceLot.formatCode,
          initialBottleCount: data.count,
          currentBottleCount: data.count,
          status: "EN_CAVE",
          degorgementDate: new Date(),
          dosageValue: dosageValue,
          dosageUnit: "g/L",
          locationZone: sourceLot.locationZone
        }
      });

      // 3. Événements
      const event = await tx.bottleEvent.create({
        data: { eventType: "DEGORGEMENT", operatorUserId: operatorId, comment: data.note }
      });

      await tx.bottleEventLink.createMany({
        data: [
          { eventId: event.id, bottleLotId: sourceLot.id, roleInEvent: "SOURCE", bottleCount: data.count },
          { eventId: event.id, bottleLotId: newLot.id, roleInEvent: "CIBLE", bottleCount: data.count }
        ]
      });

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "DEGORGEMENT", userId: userEmail } });
      return { status: "SUCCESS", newLot };
    });
  }

  // =========================================================================
  // 3. HABILLAGE (Création du lot "Produit Fini" + Déduction Stocks Secs)
  // =========================================================================
  static async habiller(data: z.infer<typeof HabillerSchema>, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Habillage déjà enregistré.");

      const sourceLot = await tx.bottleLot.findUnique({ where: { id: data.blId } });
      if (!sourceLot || sourceLot.currentBottleCount < data.count) throw new Error("Stock de bouteilles nues insuffisant.");

      const operatorId = await this.getUserId(tx, userEmail);

      // 1. Déduire du lot nu
      const newCount = sourceLot.currentBottleCount - data.count;
      await tx.bottleLot.update({
        where: { id: sourceLot.id },
        data: { 
          currentBottleCount: newCount,
          status: newCount <= 0 ? 'HABILLE_TOTALEMENT' : sourceLot.status
        }
      });

      // 2. Créer le lot Habillé
      const totalLots = await tx.bottleLot.count();
      const code = `HAB-${new Date().getFullYear()}-${String(totalLots + 1).padStart(3, "0")}`;

      const habLot = await tx.bottleLot.create({
        data: {
          technicalCode: `HAB-${Date.now()}`,
          businessCode: code,
          type: 'HABILLAGE',
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
          locationZone: sourceLot.locationZone
        }
      });

      // 3. Déduction Matières Sèches
      const deductProd = async (id: number | null | undefined, qty: number, note: string) => {
        if (!id) return;
        const prod = await tx.product.findUnique({ where: { id } });
        if (!prod || Number(prod.currentStock) < qty) throw new Error(`Stock insuffisant pour la matière sèche ID ${id}`);
        await tx.product.update({ where: { id }, data: { currentStock: Number(prod.currentStock) - qty } });
        await tx.stockMovement.create({
          data: { productId: id, type: "OUT", quantity: qty, note, operator: userEmail }
        });
      };

      await deductProd(data.coiffeId, data.count, `Habillage ${sourceLot.businessCode}`);
      await deductProd(data.etiquetteId, data.count, `Habillage ${sourceLot.businessCode}`);
      if (data.cartonId) {
        const cartonQty = Math.ceil(data.count / data.cartonSize);
        await deductProd(data.cartonId, cartonQty, `Cartons (${data.cartonSize}) ${sourceLot.businessCode}`);
      }

      // 4. Événements
      const event = await tx.bottleEvent.create({
        data: { eventType: "HABILLAGE", operatorUserId: operatorId, comment: `Habillage de ${data.count} btl` }
      });
      await tx.bottleEventLink.createMany({
        data: [
          { eventId: event.id, bottleLotId: sourceLot.id, roleInEvent: "SOURCE", bottleCount: data.count },
          { eventId: event.id, bottleLotId: habLot.id, roleInEvent: "CIBLE", bottleCount: data.count }
        ]
      });

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "HABILLAGE", userId: userEmail } });
      return { status: "SUCCESS", habLot };
    });
  }

  // =========================================================================
  // 4. EXPÉDITION (Création du Shipment)
  // =========================================================================
  static async expedier(data: z.infer<typeof ExpedierSchema>, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Expédition déjà enregistrée.");

      const lot = await tx.bottleLot.findUnique({ where: { id: data.blId } });
      if (!lot || lot.currentBottleCount < data.count) throw new Error("Stock insuffisant pour cette expédition.");

      const operatorId = await this.getUserId(tx, userEmail);

      // 1. Déduire le stock
      const newCount = lot.currentBottleCount - data.count;
      await tx.bottleLot.update({
        where: { id: lot.id },
        data: { 
          currentBottleCount: newCount,
          status: newCount <= 0 ? 'EXPEDIE_TOTALEMENT' : lot.status
        }
      });

      // 2. Créer l'expédition dans la table dédiée Shipment
      const shipment = await tx.shipment.create({
        data: {
          shipmentDate: new Date(),
          customerName: data.clientName,
          comment: `Expédié par ${userEmail}`
        }
      });

      await tx.shipmentLine.create({
        data: {
          shipmentId: shipment.id,
          bottleLotId: lot.id,
          bottleCount: data.count
        }
      });

      // 3. Traçabilité Événement Bouteille
      const event = await tx.bottleEvent.create({
        data: { eventType: "EXPEDITION", operatorUserId: operatorId, comment: `Expédition à ${data.clientName}` }
      });

      await tx.bottleEventLink.create({
        data: { eventId: event.id, bottleLotId: lot.id, roleInEvent: "SOURCE", bottleCount: data.count }
      });

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "EXPEDITION", userId: userEmail } });
      return { status: "SUCCESS", shipment };
    });
  }
}
