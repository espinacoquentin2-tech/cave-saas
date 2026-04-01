// services/pressings.service.ts
<<<<<<< HEAD
import { Lot } from '@prisma/client';
=======
import { Lot, PrismaClient } from '@prisma/client';
>>>>>>> main
import { LoadPressSchema, EcoulementSchema } from '../validations/pressings.schema';
import { z } from 'zod';
import { prisma } from '@/server/shared/prisma';
import { prisma } from '@/server/shared/prisma';


export class PressingService {
  
  // 1. CHARGEMENT DU PRESSOIR
  static async load(data: z.infer<typeof LoadPressSchema>) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Chargement déjà enregistré.");

      const press = await tx.pressoir.findUnique({ where: { id: data.pressId } });
      const apport = await tx.pressing.findUnique({ where: { id: data.apportId } }); 

      if (!press || !apport) throw new Error("Pressoir ou Apport introuvable.");
      if (data.weightToLoad > Number(apport.weight)) throw new Error("Poids demandé supérieur au disponible sur le quai.");
      if (data.weightToLoad > Number(apport.weight)) throw new Error("Poids demandé supérieur au disponible sur le quai.");

      const currentLoad = press.loadKg || 0;

      // Anti-Mélange (Sécurité Backend)
      if (!data.forceMix && currentLoad > 0 && press.cepage && press.cepage !== apport.cepage) {
        throw new Error("MIX_WARNING: Mélange de cépages détecté. Forcez l'opération si souhaité.");
      }

      const totalLoad = currentLoad + data.weightToLoad;
      const newCepage = currentLoad >= data.weightToLoad ? press.cepage : apport.cepage;

      // Fusion des noms de parcelles (Traçabilité)
      let newParcelle = press.parcelle || "";
      const apportStr = `${apport.cru} (${apport.cepage})`;
      if (newParcelle && !newParcelle.includes(apportStr)) {
        if (!newParcelle.includes("(")) newParcelle = `${newParcelle} (${press.cepage})`;
        newParcelle += ` + ${apportStr}`;
      } else if (!newParcelle) {
        newParcelle = apport.cru;
      }

      // Mise à jour du quai (Apport)
      const remainingWeight = Number(apport.weight) - data.weightToLoad;
      const remainingWeight = Number(apport.weight) - data.weightToLoad;
      await tx.pressing.update({
        where: { id: apport.id },
        data: { weight: remainingWeight, status: remainingWeight <= 0 ? "PRESSÉ" : "EN_ATTENTE" }
      });

      // Mise à jour du Pressoir
      const updatedPress = await tx.pressoir.update({
        where: { id: press.id },
        data: {
          status: "EN_COURS",
          loadKg: totalLoad,
          parcelle: newParcelle,
          cepage: newCepage,
        }
      });

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "LOAD_PRESS", userId: "System" } });
      return { status: "SUCCESS", press: updatedPress };
    });
  }

  // 2. ÉCOULEMENT (Fractionnement)
  static async ecoulement(data: z.infer<typeof EcoulementSchema>) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Écoulement déjà effectué.");

      const press = await tx.pressoir.findUnique({ where: { id: data.pressId } });
      if (!press || press.status === "VIDE") throw new Error("Pressoir vide ou introuvable.");

      const millesime = new Date().getFullYear();
      const ts = Date.now();
      const cruFormatted = (press.parcelle || "Inconnu").toUpperCase().replace(/\s+/g,"-");
      let counter = 0;
      
      const newLots: Lot[] = [];
      const newLots: Lot[] = [];

      // Définition d'un type local pour les paramètres de destination
      type DestinationInput = { cuveId: number; vol: number };

      // Correction 2 & 3 : Typage explicite des arguments de la fonction locale
      const createLot = async (
        dests: DestinationInput[], 
        suffix: string, 
        desc: string, 
        baseStatus: string
      ) => {
        for (const dest of dests) {
          const code = `${millesime}-${press.cepage}-${cruFormatted}-${suffix}-${String(ts + counter).slice(-4)}`;
          
          const lot = await tx.lot.create({
            data: {
              technicalCode: code,
              businessCode: code,
              year: millesime,
              mainGrapeCode: press.cepage || "MULTI",
              sequenceNumber: counter + 1,
              currentVolume: dest.vol,
              currentContainerId: dest.cuveId,
              status: baseStatus,
              notes: desc
              // Correction 3 : Suppression de 'operator' car il n'existe pas sur la table Lot
            }
          });

          await tx.container.update({ where: { id: dest.cuveId }, data: { status: "PLEIN" } });
          
          // Traçabilité de l'opérateur via l'événement (Puisque 'operator' n'est pas sur Lot)
          const user = await tx.user.findFirst({ where: { name: data.operator } });
          const event = await tx.lotEvent.create({
            data: {
              eventType: 'PRESSURAGE',
              operatorUserId: user?.id || 1,
              comment: `Jus écoulé du pressoir ${press.nom}`
            }
          });

          await tx.lotEventLot.create({
            data: { eventId: event.id, lotId: lot.id, roleInEvent: 'CIBLE', volumeChange: dest.vol }
          });
          
          newLots.push(lot);
          counter++;
        }
      };

      // Exécution des créations (en série pour garantir l'ACIDité)
      await createLot(data.cuveeDests, "C", "Jus de Cuvée", "MOUT_NON_DEBOURBE");
      await createLot(data.tailleDests, "T", "Jus de Taille", "MOUT_NON_DEBOURBE");
      await createLot(data.rebechesDests, "R", "Jus de Rebêches (Distillerie)", "REBECHES");

      // Libérer la machine
      await tx.pressoir.update({
        where: { id: press.id },
        data: { status: "VIDE", loadKg: null, parcelle: null, cepage: null }
      });

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "ECOULEMENT", userId: data.operator } });
      return { status: "SUCCESS", newLots };
    });
  }
}

