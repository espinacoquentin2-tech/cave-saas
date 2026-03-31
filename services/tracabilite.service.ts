// services/tracabilite.service.ts
import { BottleLot, Lot, LotEvent, PrismaClient } from '@prisma/client';
import { TraceabilityRequestPayload } from '../validations/tracabilite.schema';
import { prisma } from '@/server/shared/prisma';


export class TracabiliteService {
  static async getLineage(data: TraceabilityRequestPayload) {
    const { lotCode, type } = data;

    type TraceableLot = (Lot | BottleLot) & { _type: 'bulk' | 'bottle' };
    let focusedLot: TraceableLot;
    let parents: TraceableLot[] = [];
    let children: TraceableLot[] = [];
    let expeditions: LotEvent[] = [];

    // 1. TROUVER LE LOT CIBLE
    if (type === "bulk") {
      const lot = await prisma.lot.findFirst({ where: { businessCode: lotCode } });
      if (!lot) throw new Error("Lot Vrac introuvable.");
      focusedLot = { ...lot, _type: 'bulk' };
    } else {
      const bLot = await prisma.bottleLot.findFirst({ where: { businessCode: lotCode } });
      if (!bLot) throw new Error("Lot Bouteille introuvable.");
      focusedLot = { ...bLot, _type: 'bottle' };
    }

    // 2. RECHERCHE DES PARENTS (Ascendance)
    if (type === "bottle" && focusedLot.sourceLotId) {
      const parent = await prisma.lot.findUnique({ where: { id: focusedLot.sourceLotId } });
      if (parent) parents.push({ ...parent, _type: 'bulk' });
      
    // 👈 CORRECTION : On vérifie bien que notes existe ET que c'est une string
    } else if (focusedLot.notes && typeof focusedLot.notes === 'string' && focusedLot.notes.includes("Sources:")) {
      
      // 👈 CORRECTION : Typage explicite du (c: string)
      const sourceCodes = focusedLot.notes.split("Sources:")[1].split(",").map((c: string) => c.trim());
      
      const parentBulks = await prisma.lot.findMany({ where: { businessCode: { in: sourceCodes } } });
      const parentBottles = await prisma.bottleLot.findMany({ where: { businessCode: { in: sourceCodes } } });
      
      parents = [
        ...parentBulks.map(p => ({ ...p, _type: 'bulk' })),
        ...parentBottles.map(p => ({ ...p, _type: 'bottle' }))
      ];
    }

    // 3. RECHERCHE DES ENFANTS ET EXPÉDITIONS (Descendance)
    
    // Recherche des Vracs enfants (Seul Lot a le champ notes)
    const childBulks = await prisma.lot.findMany({
      where: { notes: { contains: focusedLot.businessCode } }
    });
    
    // Recherche des Bouteilles enfants
    let childBottles: BottleLot[] = [];
    if (type === "bulk") {
      // Uniquement si le parent est un vrac, il peut avoir des bouteilles enfants via sourceLotId
      childBottles = await prisma.bottleLot.findMany({
        where: { sourceLotId: focusedLot.id }
      });
    }

    children = [
      ...childBulks.map(c => ({ ...c, _type: 'bulk' })),
      ...childBottles.map(c => ({ ...c, _type: 'bottle' }))
    ];

    // Recherche des expéditions
    const allExpeditions = await prisma.lotEvent.findMany({
      where: { eventType: "EXPEDITION" } 
    });

    // Filtre des expéditions liées au lot ciblé
    expeditions = allExpeditions.filter(e => e.comment && e.comment.includes(focusedLot.businessCode));

    // 4. FORMATAGE ET RETOUR
    return {
      focusedLot,
      parents,
      children,
      expeditions
    };
  }
}
