// services/tirage.service.ts
import { PrismaClient } from '@prisma/client';
import { ExecuteMixtionPayload, TiragePayload } from '../validations/tirage.schema';
import { BusinessLogicError } from '../lib/errors';

const prisma = new PrismaClient();

export class TirageService {
  
  // ==========================================
  // 1. OPERATION DE MIXTION (Calculs CIVC)
  // ==========================================
  static async executeMixtion(data: ExecuteMixtionPayload, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. ANTI-DOUBLE CLIC (Idempotence)
      const existingTx = await tx.idempotencyRecord.findUnique({
        where: { key: data.idempotencyKey }
      });
      if (existingTx) {
        throw new BusinessLogicError("Cette mixtion a déjà été exécutée.");
      }

      // 2. VÉRIFICATION DES CUVES ET RÉCUPÉRATION DU VIN
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

      if (!baseTank || !levainTank || !destTank) throw new BusinessLogicError("Une ou plusieurs cuves sont introuvables.", 404);

      const baseLot = baseTank.currentLots?.[0];
      const levainLot = levainTank.currentLots?.[0];

      if (!baseLot) throw new BusinessLogicError("La cuve de base est vide (aucun lot de vin trouvé à l'intérieur).");
      if (!levainLot) throw new BusinessLogicError("La cuve à levain est vide (aucun lot trouvé à l'intérieur).");

      // Conversion des Decimal Prisma en Number JS pour les comparaisons mathématiques
      const currentBaseVol = Number(baseLot.currentVolume);
      const currentLevainVol = Number(levainLot.currentVolume);

      if (currentBaseVol < data.baseVolToDraw) {
        throw new BusinessLogicError(`Volume insuffisant dans le lot de base. Dispo: ${currentBaseVol} hL.`);
      }

      // 3. CALCULS MATHÉMATIQUES (Méthode CIVC)
      const baseSugar = 1.0; 
      const targetSugarGF = (data.targetPressure * 4) * (25.4 / 24.0);
      const volLevain = data.baseVolToDraw * (data.levainPct / 100);
      
      if (currentLevainVol < volLevain) {
        throw new BusinessLogicError(`Volume insuffisant dans le levain. Requis: ${volLevain.toFixed(2)} hL.`);
      }

      const volVinLevain = data.baseVolToDraw + volLevain;
      const sucreVinLevain = ((data.baseVolToDraw * baseSugar) + (volLevain * data.levainSugar)) / volVinLevain;
      const sucreManquant = targetSugarGF - sucreVinLevain;

      if (sucreManquant <= 0) throw new BusinessLogicError("Le vin contient déjà trop de sucre.");

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

      const deductProductStock = async (productName: string, subCategory: string, qty: number) => {
        let prod = await tx.product.findFirst({ where: { name: productName } });
        if (!prod) prod = await tx.product.findFirst({ where: { subCategory: subCategory } });
        
        if (!prod) {
          prod = await tx.product.create({
            data: { name: productName, category: "Matières Sèches", subCategory, unit: "unités", currentStock: 0, minStock: 0 }
          });
        }

        if (Number(prod.currentStock) < qty) {
          throw new BusinessLogicError(`Stock de ${prod.name} insuffisant. Requis: ${qty}, Dispo: ${Number(prod.currentStock)}. Allez dans 'Inventaire' pour ajuster.`);
        }

        // Mise à jour ATOMIQUE du stock
        await tx.product.update({
          where: { id: prod.id },
          data: { currentStock: { decrement: qty } }
        });

        await tx.stockMovement.create({
          data: { 
            productId: prod.id, type: "OUT", quantity: qty, 
            note: `Tirage / Mixtion automatique`, operator: userEmail 
          }
        });
      };

      await deductProductStock(isBottle ? "Bouteilles 75cl" : "Magnums 1.5L", "Bouteilles", nbCols);
      
      if (isCapsule) {
        await deductProductStock("Capsules Tirage", "Capsules", nbCols);
        await deductProductStock("Bidules", "Bidules", nbCols);
      } else {
        await deductProductStock("Bouchons Liège", "Bouchons", nbCols);
        await deductProductStock("Agrafes", "Autre", nbCols);
      }

      // 5. MISE À JOUR EN BASE DE DONNÉES DU VIN (Atomique)
      await tx.lot.update({
        where: { id: baseLot.id },
        data: { currentVolume: { decrement: data.baseVolToDraw } }
      });

      await tx.lot.update({
        where: { id: levainLot.id },
        data: { currentVolume: { decrement: volLevain } }
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

  // ==========================================
  // 2. OPERATION DE TIRAGE SIMPLE / MISE
  // ==========================================
  static async executeTirage(data: TiragePayload, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new BusinessLogicError("Ce tirage a déjà été enregistré.");

      const sourceLot = await tx.lot.findUnique({ where: { id: data.lotId } });
      if (!sourceLot) throw new BusinessLogicError("Lot source introuvable.", 404);
      
      if (Number(sourceLot.currentVolume) < data.volume) {
        throw new BusinessLogicError(`Volume insuffisant ! Le lot ne contient que ${Number(sourceLot.currentVolume)} hL.`);
      }

      const updatedLot = await tx.lot.update({
        where: { id: sourceLot.id },
        data: {
          currentVolume: { decrement: data.volume },
        }
      });

      if (Number(updatedLot.currentVolume) < 0) {
         throw new BusinessLogicError("Erreur critique de concurrence : le volume final serait négatif.");
      }

      if (Number(updatedLot.currentVolume) === 0) {
        await tx.lot.update({ where: { id: sourceLot.id }, data: { status: 'TIRE' } });
      }

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

      // Simulation de la récupération User (à adapter selon ton auth)
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
        data: { eventId: lotEvent.id, lotId: sourceLot.id, roleInEvent: 'SOURCE', volumeChange: data.volume, unit: 'hL' }
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

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "TIRAGE", userId: userEmail } });

      return { status: "SUCCESS", bottleLotCode: bottleLot.businessCode };
    });
  }
}