// services/tracabilite.service.ts
import { BottleLot, Lot, LotEvent } from '@prisma/client';
import { TraceabilityRequestPayload } from '../validations/tracabilite.schema';
import { prisma } from '@/server/shared/prisma';


export class TracabiliteService {
  static async getLineage(data: TraceabilityRequestPayload) {
    const { lotCode, type } = data;

    type BulkTraceableLot = Lot & { _type: 'bulk' };
    type BottleTraceableLot = BottleLot & { _type: 'bottle' };
    type TraceableLot = BulkTraceableLot | BottleTraceableLot;
    const toBulkTraceable = (lot: Lot): BulkTraceableLot => ({ ...lot, _type: 'bulk' });
    const toBottleTraceable = (lot: BottleLot): BottleTraceableLot => ({ ...lot, _type: 'bottle' });

    // 1. TROUVER LE LOT CIBLE
    if (type === "bulk") {
      const lot = await prisma.lot.findFirst({ where: { businessCode: lotCode } });
      if (!lot) throw new Error("Lot Vrac introuvable.");
      focusedLot = toBulkTraceable(lot);
    } else {
      const bLot = await prisma.bottleLot.findFirst({ where: { businessCode: lotCode } });
      if (!bLot) throw new Error("Lot Bouteille introuvable.");
      focusedLot = toBottleTraceable(bLot);
    }

    // 2. RECHERCHE DES PARENTS (Ascendance)
    if (focusedLot._type === 'bottle' && focusedLot.sourceLotId) {
      const parent = await prisma.lot.findUnique({ where: { id: focusedLot.sourceLotId } });
      if (parent) parents.push(toBulkTraceable(parent));
      
    // 👈 CORRECTION : On vérifie bien que notes existe ET que c'est une string
    } else if (focusedLot._type === 'bulk' && focusedLot.notes && focusedLot.notes.includes("Sources:")) {
      
      // 👈 CORRECTION : Typage explicite du (c: string)
      const sourceCodes = focusedLot.notes.split("Sources:")[1].split(",").map((c: string) => c.trim());
      
      const parentBulks = await prisma.lot.findMany({ where: { businessCode: { in: sourceCodes } } });
      const parentBottles = await prisma.bottleLot.findMany({ where: { businessCode: { in: sourceCodes } } });
      
      parents = [
        ...parentBulks.map((p) => toBulkTraceable(p)),
        ...parentBottles.map((p) => toBottleTraceable(p))
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
      ...childBulks.map((c) => toBulkTraceable(c)),
      ...childBottles.map((c) => toBottleTraceable(c))
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
