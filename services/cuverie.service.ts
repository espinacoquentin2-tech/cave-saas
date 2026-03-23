// services/cuverie.service.ts
import { PrismaClient } from '@prisma/client';
import { DecuvageSchema, TransferSchema } from '../validations/cuverie.schema';
import { z } from 'zod';

const prisma = new PrismaClient();

export class CuverieService {
  
  // Fonction utilitaire pour récupérer l'ID utilisateur (sécurité)
  private static async getUserId(tx: any, email: string) {
    const user = await tx.user.findUnique({ where: { email } });
    if (!user) throw new Error("Utilisateur non autorisé.");
    return user.id;
  }

  // =========================================================================
  // 1. DÉCUVAGE (Séparation Goutte / Presse)
  // =========================================================================
  static async executeDecuvage(data: z.infer<typeof DecuvageSchema>, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Décuvage déjà enregistré.");

      const sourceLot = await tx.lot.findUnique({ where: { id: data.sourceLotId } });
      if (!sourceLot) throw new Error("Lot source introuvable.");

      const operatorId = await this.getUserId(tx, userEmail);
      
      // 👈 CORRECTION 1 : Typage explicite du tableau pour rassurer TypeScript
      const newLots: any[] = [];

      // Événement racine
      const event = await tx.lotEvent.create({
        data: {
          eventType: 'DECUVAGE',
          operatorUserId: operatorId,
          comment: `Décuvage. Goutte: ${data.volGoutte}hL, Presse: ${data.volPresse}hL. ${data.notes || ''}`
        }
      });

      // Archiver le lot d'origine
      await tx.lot.update({
        where: { id: sourceLot.id },
        data: { currentVolume: 0, status: "ARCHIVE" }
      });
      await tx.lotEventLot.create({
        data: { eventId: event.id, lotId: sourceLot.id, roleInEvent: 'SOURCE', volumeChange: -(data.volGoutte + data.volPresse) }
      });

      // Mettre la cuve en nettoyage
      await tx.container.update({
        where: { id: data.sourceContainerId },
        data: { status: "NETTOYAGE" }
      });
      await tx.lotEventContainer.create({
        data: { eventId: event.id, containerId: data.sourceContainerId, roleInEvent: 'SOURCE' }
      });

      // Fonction locale de création des sous-lots
      const createSubLot = async (vol: number, targetContainerId: number | null | undefined, suffix: string, typeDesc: string) => {
        if (vol <= 0) return;
        const newLot = await tx.lot.create({
          data: {
            technicalCode: `${sourceLot.technicalCode}${suffix}-${Date.now()}`,
            businessCode: `${sourceLot.businessCode}${suffix}`,
            year: sourceLot.year,
            mainGrapeCode: sourceLot.mainGrapeCode,
            sequenceNumber: sourceLot.sequenceNumber,
            currentVolume: vol,
            currentContainerId: targetContainerId || null,
            status: data.finalStatus,
            notes: `${typeDesc} issu du décuvage. ${data.notes || ''}`
          }
        });

        await tx.lotEventLot.create({
          data: { eventId: event.id, lotId: newLot.id, roleInEvent: 'CIBLE', volumeChange: vol }
        });

        if (targetContainerId) {
          await tx.container.update({ where: { id: targetContainerId }, data: { status: "PLEIN" } });
          await tx.lotEventContainer.create({
            data: { eventId: event.id, containerId: targetContainerId, roleInEvent: 'CIBLE' }
          });
        }
        newLots.push(newLot);
      };

      await createSubLot(data.volGoutte, data.cuveGoutteId, "-G", "Vin de Goutte");
      await createSubLot(data.volPresse, data.cuvePresseId, "-P", "Vin de Presse");

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "DECUVAGE", userId: userEmail } });
      return { status: "SUCCESS", newLots };
    });
  }

  // =========================================================================
  // 2. TRANSFERT / SOUTIRAGE / ÉCLATEMENT
  // =========================================================================
  static async executeTransfer(data: z.infer<typeof TransferSchema>, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Transfert déjà effectué.");

      const sourceLot = await tx.lot.findUnique({ where: { id: data.lotId } });
      const sourceContainer = await tx.container.findUnique({ where: { id: data.fromId } });
      if (!sourceLot || !sourceContainer) throw new Error("Source introuvable.");

      if (sourceLot.currentVolume < data.volume) throw new Error(`Volume source insuffisant. Dispo: ${sourceLot.currentVolume}hL`);

      const operatorId = await this.getUserId(tx, userEmail);

      // Événement racine
      const event = await tx.lotEvent.create({
        data: {
          eventType: 'TRANSFERT',
          eventDatetime: new Date(data.date),
          operatorUserId: operatorId,
          comment: `Soutirage / Transfert éclaté de ${data.volume}hL.`
        }
      });

      // 👈 CORRECTION : Calcul exact du reste
      const newSourceVol = sourceLot.currentVolume - data.volume;
      const isEmpty = newSourceVol <= 0.05; // Marge d'erreur flottante
      
      if (isEmpty && !data.remainderType) {
        // Transfert total simple
        await tx.lot.update({ where: { id: sourceLot.id }, data: { currentVolume: 0, status: "ARCHIVE" } });
        await tx.container.update({ where: { id: sourceContainer.id }, data: { status: "NETTOYAGE" } });
      } 
      else if (!isEmpty && data.remainderType) {
        // Transfert avec création de Bourbes/Lies
        const targetRemId = data.bourbesDestId || sourceContainer.id;
        
        await tx.lot.update({ where: { id: sourceLot.id }, data: { currentVolume: 0, status: "ARCHIVE" } });
        
        await tx.lot.create({
          data: {
             technicalCode: `${sourceLot.technicalCode}-${data.remainderType.charAt(0)}`,
             businessCode: `${sourceLot.businessCode}-${data.remainderType.charAt(0)}`,
             year: sourceLot.year,
             mainGrapeCode: sourceLot.mainGrapeCode,
             sequenceNumber: sourceLot.sequenceNumber,
             currentVolume: newSourceVol,
             currentContainerId: targetRemId,
             status: data.remainderType,
             notes: `Reste (${data.remainderType}) issu de soutirage.`
          }
        });

        if (targetRemId !== sourceContainer.id) {
           await tx.container.update({ where: { id: sourceContainer.id }, data: { status: "VIDE" } });
           await tx.container.update({ where: { id: targetRemId }, data: { status: "PLEIN" } });
        }
      } 
      else {
        // Transfert partiel simple (le lot reste dans sa cuve avec moins de volume)
        await tx.lot.update({ where: { id: sourceLot.id }, data: { currentVolume: newSourceVol } });
      }

      await tx.lotEventLot.create({ data: { eventId: event.id, lotId: sourceLot.id, roleInEvent: 'SOURCE', volumeChange: data.volume } });
      await tx.lotEventContainer.create({ data: { eventId: event.id, containerId: sourceContainer.id, roleInEvent: 'SOURCE' } });

      // Ajout dans les cuves cibles
      let counter = 1;
      for (const dest of data.destinations) {
        const targetContainer = await tx.container.findUnique({ where: { id: dest.toId }, include: { currentLots: true } });
        if (!targetContainer) throw new Error(`Cuve cible ID ${dest.toId} introuvable.`);
        
        const targetCurrentVol = targetContainer.currentLots.reduce((sum, l) => sum + l.currentVolume, 0);
        if (targetCurrentVol + dest.volume > targetContainer.capacityValue + 0.1) {
          throw new Error(`Débordement de la cuve ${targetContainer.code || targetContainer.id}.`);
        }

        const suffix = `-T${Date.now().toString().slice(-4)}${counter}`;
        const targetLot = await tx.lot.create({
          data: {
             technicalCode: `${sourceLot.technicalCode}${suffix}`,
             businessCode: `${sourceLot.businessCode}${suffix}`,
             year: sourceLot.year,
             mainGrapeCode: sourceLot.mainGrapeCode,
             sequenceNumber: sourceLot.sequenceNumber,
             currentVolume: dest.volume,
             currentContainerId: dest.toId,
             status: sourceLot.status
          }
        });

        await tx.container.update({ where: { id: dest.toId }, data: { status: "PLEIN" } });
        await tx.lotEventLot.create({ data: { eventId: event.id, lotId: targetLot.id, roleInEvent: 'CIBLE', volumeChange: dest.volume } });
        await tx.lotEventContainer.create({ data: { eventId: event.id, containerId: dest.toId, roleInEvent: 'CIBLE' } });
        counter++;
      }

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "TRANSFER", userId: userEmail } });
      return { status: "SUCCESS" };
    });
  }
}