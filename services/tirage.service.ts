// services/tirage.service.ts
import { PrismaClient } from '@prisma/client';
import { ExecuteMixtionPayload, TirageSchema } from '../validations/tirage.schema';
import { z } from 'zod';

const prisma = new PrismaClient();

export class TirageService {
  static async executeMixtion(data: ExecuteMixtionPayload, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. ANTI-DOUBLE CLIC (Idempotence)
      const existingTx = await tx.idempotencyRecord.findUnique({
        where: { key: data.idempotencyKey }
      });
      if (existingTx) {
        throw new Error("ALREADY_APPLIED: Cette mixtion a déjà été exécutée.");
      }

      // 2. VÉRIFICATION DES CUVES ET RÉCUPÉRATION DU VIN (LES LOTS)
      const baseTank = await tx.container.findUnique({ 
        where: { id: parseInt(data.baseTankId) },
        include: { currentLots: true }
      });
      
      const levainTank = await tx.container.findUnique({ 
        where: { id: parseInt(data.levainTankId) },
        include: { currentLots: true }
      });
      
      const destTank = await tx.container.findUnique({ 
        where: { id: parseInt(data.destTankId) } 
      });

      if (!baseTank || !levainTank || !destTank) throw new Error("Une ou plusieurs cuves sont introuvables.");

      const baseLot = baseTank.currentLots?.[0];
      const levainLot = levainTank.currentLots?.[0];

      if (!baseLot) throw new Error("La cuve de base est vide (aucun lot de vin trouvé à l'intérieur).");
      if (!levainLot) throw new Error("La cuve à levain est vide (aucun lot trouvé à l'intérieur).");

      if (baseLot.currentVolume < data.baseVolToDraw) {
        throw new Error(`Volume insuffisant dans le lot de base. Dispo: ${baseLot.currentVolume} hL.`);
      }

      // 3. CALCULS MATHÉMATIQUES (Méthode CIVC)
      const baseSugar = 1.0; 
      const targetSugarGF = (data.targetPressure * 4) * (25.4 / 24.0);
      const volLevain = data.baseVolToDraw * (data.levainPct / 100);
      
      if (levainLot.currentVolume < volLevain) {
        throw new Error(`Volume insuffisant dans le levain. Requis: ${volLevain.toFixed(2)} hL.`);
      }

      const volVinLevain = data.baseVolToDraw + volLevain;
      const sucreVinLevain = ((data.baseVolToDraw * baseSugar) + (volLevain * data.levainSugar)) / volVinLevain;
      const sucreManquant = targetSugarGF - sucreVinLevain;

      if (sucreManquant <= 0) throw new Error("Le vin contient déjà trop de sucre.");

      let volMixtion = 0;
      if (data.sugarSource === "LIQUEUR" && data.liqueurSugar) {
        const volLiqueur = (volVinLevain * sucreManquant) / (data.liqueurSugar - sucreManquant);
        volMixtion = volVinLevain + volLiqueur;
      } else {
        const poidsSucre = (volVinLevain * sucreManquant) / (1 - (sucreManquant * 0.00063));
        volMixtion = volVinLevain + (poidsSucre * 0.00063);
      }

      // 4. VÉRIFICATION DES STOCKS MATIÈRES SÈCHES (NOUVEAU CATALOGUE)
      const nbCols = Math.floor((volMixtion * 100) / data.tirageFormat);
      const isBottle = data.tirageFormat === 0.75;
      const isCapsule = data.tirageBouchage === "CAPSULE";

      // Fonction utilitaire locale pour déduire un stock de produit dynamiquement
      const deductProductStock = async (productName: string, subCategory: string, qty: number) => {
        // On cherche le produit par nom ou par sous-catégorie
        let prod = await tx.product.findFirst({ where: { name: productName } });
        if (!prod) prod = await tx.product.findFirst({ where: { subCategory: subCategory } });
        
        // Si le produit n'existe vraiment pas dans le catalogue, on le crée à 0 pour lever l'alerte proprement
        if (!prod) {
          prod = await tx.product.create({
            data: { name: productName, category: "Matières Sèches", subCategory, unit: "unités", currentStock: 0, minStock: 0 }
          });
        }

        if (prod.currentStock < qty) {
          throw new Error(`Stock de ${prod.name} insuffisant. Requis: ${qty}, Dispo: ${prod.currentStock}. Allez dans 'Inventaire' pour ajuster.`);
        }

        // On met à jour le stock
        await tx.product.update({
          where: { id: prod.id },
          data: { currentStock: prod.currentStock - qty }
        });

        // On trace le mouvement
        await tx.stockMovement.create({
          data: { 
            productId: prod.id, type: "OUT", quantity: qty, 
            note: `Tirage / Mixtion automatique`, operator: userEmail 
          }
        });
      };

      // Exécution des déductions
      await deductProductStock(isBottle ? "Bouteilles 75cl" : "Magnums 1.5L", "Bouteilles", nbCols);
      
      if (isCapsule) {
        await deductProductStock("Capsules Tirage", "Capsules", nbCols);
        await deductProductStock("Bidules", "Bidules", nbCols);
      } else {
        await deductProductStock("Bouchons Liège", "Bouchons", nbCols);
        await deductProductStock("Agrafes", "Autre", nbCols);
      }

      // 5. MISE À JOUR EN BASE DE DONNÉES DU VIN (Mouvements)
      await tx.lot.update({
        where: { id: baseLot.id },
        data: { currentVolume: baseLot.currentVolume - data.baseVolToDraw }
      });

      await tx.lot.update({
        where: { id: levainLot.id },
        data: { currentVolume: levainLot.currentVolume - volLevain }
      });

      const newLot = await tx.lot.create({
        data: {
          technicalCode: `MIX-${Date.now()}`,
          businessCode: `MIXTION-${new Date().getFullYear()}`,
          year: new Date().getFullYear(),
          mainGrapeCode: baseLot.mainGrapeCode,
          sequenceNumber: 1,
          currentVolume: volMixtion,
          currentContainerId: destTank.id,
          status: 'ASSEMBLAGE' 
        }
      });

      await tx.container.update({
        where: { id: destTank.id },
        data: { status: "PLEIN" }
      });

      // 6. TRAÇABILITÉ
      await tx.idempotencyRecord.create({
        data: { key: data.idempotencyKey, action: "MIXTION", userId: userEmail }
      });

      await tx.auditLog.create({
        data: { 
          action: "MIXTION_VALIDEE", 
          details: `Mixtion de ${volMixtion.toFixed(2)}hL vers ${destTank.displayName || destTank.code}. Création du lot ${newLot.businessCode}`, 
          userId: userEmail 
        }
      });

      return { status: "SUCCESS", volMixtion, nbCols };
    });
  }

  static async executeTirage(data: z.infer<typeof TirageSchema>, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Protection Anti Double-Clic
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Ce tirage a déjà été enregistré.");

      // 2. Vérification du Lot Source
      const sourceLot = await tx.lot.findUnique({ where: { id: data.lotId } });
      if (!sourceLot) throw new Error("Lot source introuvable.");
      if (sourceLot.currentVolume < data.volume) {
        throw new Error(`Volume insuffisant ! Le lot ne contient que ${sourceLot.currentVolume} hL.`);
      }

      // 3. Déduction du volume
      const newVolume = sourceLot.currentVolume - data.volume;
      await tx.lot.update({
        where: { id: sourceLot.id },
        data: {
          currentVolume: newVolume,
          status: newVolume <= 0 ? 'TIRE' : sourceLot.status
        }
      });

      // 4. Création du lot de Bouteilles
      const totalLots = await tx.bottleLot.count();
      const typeCode = data.isTranquille ? "MISE" : "TIRAGE";
      const targetStatus = data.isTranquille ? "EN_CAVE" : "SUR_LATTES";
      const code = `${typeCode}-${new Date(data.tirageDate).getFullYear()}-${String(totalLots + 1).padStart(3, "0")}`;

      const bottleLot = await tx.bottleLot.create({
        data: {
          technicalCode: `${code}-${Date.now().toString().slice(-4)}`,
          businessCode: code,
          type: typeCode,
          sourceLotId: sourceLot.id,
          formatCode: data.format,
          initialBottleCount: data.count,
          currentBottleCount: data.count,
          status: targetStatus,
          tirageDate: new Date(data.tirageDate),
          locationZone: data.zone || null
        }
      });

      // 5. Historisation
      const user = await tx.user.findFirst({ where: { email: userEmail } });
      const userId = user?.id || 1;

      const lotEvent = await tx.lotEvent.create({
        data: {
          eventType: typeCode,
          operatorUserId: userId,
          comment: `${typeCode}: ${data.count} btl (${data.format}) - ${data.note || ''}`,
        }
      });

      await tx.lotEventLot.create({
        data: { eventId: lotEvent.id, lotId: sourceLot.id, roleInEvent: 'SOURCE', volumeChange: data.volume }
      });

      const bEvent = await tx.bottleEvent.create({
        data: {
          eventType: data.isTranquille ? 'CREATION_MISE' : 'CREATION_TIRAGE',
          operatorUserId: userId,
          comment: data.note || (data.isTranquille ? 'Mise en bouteille de vin tranquille' : 'Tirage initial'),
        }
      });

      await tx.bottleEventLink.create({
        data: { eventId: bEvent.id, bottleLotId: bottleLot.id, roleInEvent: 'CIBLE', bottleCount: data.count }
      });

      // 6. Verrouillage de l'Idempotence
      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "TIRAGE", userId: userEmail } });

      return { status: "SUCCESS", bottleLot };
    });
  }
}