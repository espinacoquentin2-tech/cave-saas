// services/tracabilite.service.ts
import { BottleLot, Lot } from '@prisma/client';
import { TraceabilityRequestPayload } from '../validations/tracabilite.schema';
import { prisma } from '@/server/shared/prisma';


export class TracabiliteService {
  static async getLineage(data: TraceabilityRequestPayload, organizationId: number) {
    const { lotCode, type } = data;

    type BulkTraceableLot = Lot & { _type: 'bulk' };
    type BottleTraceableLot = BottleLot & { _type: 'bottle' };
    type TraceableLot = BulkTraceableLot | BottleTraceableLot;
    const toBulkTraceable = (lot: Lot): BulkTraceableLot => ({ ...lot, _type: 'bulk' });
    const toBottleTraceable = (lot: BottleLot): BottleTraceableLot => ({ ...lot, _type: 'bottle' });

    let focusedLot: TraceableLot;
    let parents: TraceableLot[] = [];
    let children: TraceableLot[] = [];
    let expeditions: Array<{ id: string; eventDatetime: Date; comment: string; metadata?: unknown }> = [];

    // 1. TROUVER LE LOT CIBLE
    if (type === "bulk") {
      const lot = await prisma.lot.findFirst({ where: { businessCode: lotCode, organizationId } });
      if (!lot) throw new Error("Lot Vrac introuvable.");
      focusedLot = toBulkTraceable(lot);
    } else {
      const bLot = await prisma.bottleLot.findFirst({ where: { businessCode: lotCode, organizationId } });
      if (!bLot) throw new Error("Lot Bouteille introuvable.");
      focusedLot = toBottleTraceable(bLot);
    }

    // 2. RECHERCHE DES PARENTS (Ascendance)
    if (focusedLot._type === 'bottle') {
      if (focusedLot.sourceLotId) {
        const parent = await prisma.lot.findFirst({ where: { id: focusedLot.sourceLotId, organizationId } });
        if (parent) parents.push(toBulkTraceable(parent));
      }

      if (focusedLot.sourceBottleLotId) {
        const parentBottle = await prisma.bottleLot.findFirst({
          where: { id: focusedLot.sourceBottleLotId, organizationId },
        });
        if (parentBottle) parents.push(toBottleTraceable(parentBottle));
      }
      
    // 👈 CORRECTION : On vérifie bien que notes existe ET que c'est une string
    } else if (focusedLot._type === 'bulk' && focusedLot.notes && focusedLot.notes.includes("Sources:")) {
      
      // 👈 CORRECTION : Typage explicite du (c: string)
      const sourceCodes = focusedLot.notes.split("Sources:")[1].split(",").map((c: string) => c.trim());
      
      const parentBulks = await prisma.lot.findMany({
        where: { businessCode: { in: sourceCodes }, organizationId },
      });
      const parentBottles = await prisma.bottleLot.findMany({
        where: { businessCode: { in: sourceCodes }, organizationId },
      });
      
      parents = [
        ...parentBulks.map((p) => toBulkTraceable(p)),
        ...parentBottles.map((p) => toBottleTraceable(p))
      ];
    }

    // 3. RECHERCHE DES ENFANTS ET EXPÉDITIONS (Descendance)
    
    // Recherche des Vracs enfants (Seul Lot a le champ notes)
    const childBulks = await prisma.lot.findMany({
      where: { organizationId, notes: { contains: focusedLot.businessCode } }
    });
    
    // Recherche des Bouteilles enfants
    let childBottles: BottleLot[] = [];
    if (type === "bulk") {
      childBottles = await prisma.bottleLot.findMany({
        where: { sourceLotId: focusedLot.id, organizationId }
      });
    } else {
      childBottles = await prisma.bottleLot.findMany({
        where: { sourceBottleLotId: focusedLot.id, organizationId }
      });
    }

    children = [
      ...childBulks.map((c) => toBulkTraceable(c)),
      ...childBottles.map((c) => toBottleTraceable(c))
    ];

    // Recherche des expéditions
    if (focusedLot._type === 'bottle') {
      const [shipmentLines, bottleEventLinks] = await Promise.all([
        prisma.shipmentLine.findMany({
          where: { bottleLotId: focusedLot.id, shipment: { organizationId } },
          include: { shipment: true },
          orderBy: { id: 'desc' },
        }),
        prisma.bottleEventLink.findMany({
          where: {
            bottleLotId: focusedLot.id,
            event: {
              organizationId,
              eventType: 'EXPEDITION',
            },
          },
          include: {
            event: true,
          },
          orderBy: { id: 'desc' },
        }),
      ]);

      expeditions = [
        ...shipmentLines.map((line) => ({
          id: `shipment-${line.id}`,
          eventDatetime: line.shipment.shipmentDate,
          comment: `${line.bottleCount} btl · ${line.shipment.customerName || 'Client non renseigné'}${line.shipment.comment ? ` · ${line.shipment.comment}` : ''}`,
          metadata: null,
        })),
        ...bottleEventLinks.map((link) => ({
          id: `event-${link.eventId}-${link.id}`,
          eventDatetime: link.event.eventDatetime,
          comment: `${link.bottleCount} btl · ${link.event.comment || 'Expédition'}`,
          metadata: link.event.metadata,
        })),
      ];
    } else {
      const allExpeditions = await prisma.lotEvent.findMany({
        where: { organizationId, eventType: { in: ["EXPEDITION", "EXPEDITION_VRAC"] } }
      });
      expeditions = allExpeditions
        .filter((e) => e.comment && e.comment.includes(focusedLot.businessCode))
        .map((e) => ({
          id: `bulk-event-${e.id}`,
          eventDatetime: e.eventDatetime,
          comment: e.comment || 'Expédition',
          metadata: e.metadata,
        }));
    }

    // 4. FORMATAGE ET RETOUR
    return {
      focusedLot,
      parents,
      children,
      expeditions
    };
  }
}
