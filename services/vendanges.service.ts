// services/vendanges.service.ts
import { z } from 'zod';
import { prisma } from '@/server/shared/prisma';
import { 
  ProjectionsRequestPayload, 
  CreateApportSchema, 
  CreatePressoirSchema, 
  UpdatePressoirSchema 
} from '../validations/vendanges.schema';


export class VendangesService {
  
  // =======================================================
  // 1. CALCULS DES PRÉVISIONS DE VENDANGES (OAD)
  // =======================================================
  static async calculateProjections(data: ProjectionsRequestPayload, organizationId?: number) {
    const maturations = await prisma.maturation.findMany({
      where: organizationId ? { organizationId } : undefined,
      orderBy: { date: 'asc' }
    });
    const parcelles = await prisma.parcelle.findMany({
      where: organizationId ? { organizationId } : undefined,
      select: {
        id: true,
        nom: true,
        commune: true,
        region: true,
        departement: true,
      },
    });

    type MaturationRecord = (typeof maturations)[number];
    type ParcelleRecord = (typeof parcelles)[number];
    const groupedMaturations: Record<string, MaturationRecord[]> = {};
    const parcellesByNom: Record<string, ParcelleRecord[]> = {};
    const parcellesById: Record<number, ParcelleRecord> = {};
    const buildLegacyProjectionKey = (parcelle: string, cepage: string) => `legacy:${parcelle}::cepage:${cepage}`;
    const buildProjectionGroupKey = (parcelleId: number | null | undefined, parcelle: string, cepage: string) =>
      parcelleId ? `parcelle:${parcelleId}::cepage:${cepage}` : buildLegacyProjectionKey(parcelle, cepage);

    for (const m of maturations) {
      const key = buildProjectionGroupKey(m.parcelleId, m.parcelle, m.cepage);
      if (!groupedMaturations[key]) groupedMaturations[key] = [];
      groupedMaturations[key].push(m);
    }
    for (const parcelle of parcelles) {
      parcellesById[parcelle.id] = parcelle;
      if (!parcellesByNom[parcelle.nom]) parcellesByNom[parcelle.nom] = [];
      parcellesByNom[parcelle.nom].push(parcelle);
    }

    const projections = [];

    for (const [key, records] of Object.entries(groupedMaturations)) {
      if (records.length === 0) continue;

      const last = records[records.length - 1];
      const prev = records.length > 1 ? records[records.length - 2] : null;

      let degrePerDay = 0.15; 
      const currentDeg = last.tavp || 0;
      const prevDeg = prev?.tavp || 0;

      if (prev && currentDeg && prevDeg) {
        const days = (new Date(last.date).getTime() - new Date(prev.date).getTime()) / (1000 * 3600 * 24);
        if (days > 0) {
          const diff = currentDeg - prevDeg;
          degrePerDay = diff > 0 ? diff / days : 0.05; 
        }
      }

      const directParcelle = last.parcelleId ? parcellesById[last.parcelleId] ?? null : null;
      const matchingParcelles = parcellesByNom[last.parcelle] || [];
      const resolvedParcelle = directParcelle ?? (matchingParcelles.length === 1 ? matchingParcelles[0] : null);
      const projectionParcelleId = last.parcelleId ?? resolvedParcelle?.id;
      const projectionKey = buildProjectionGroupKey(projectionParcelleId, last.parcelle, last.cepage);
      const legacyProjectionKey = buildLegacyProjectionKey(last.parcelle, last.cepage);
      const targetKey = [projectionKey, projectionParcelleId ? String(projectionParcelleId) : null, legacyProjectionKey, key]
        .find((candidate) => candidate && Object.prototype.hasOwnProperty.call(data.customTargets, candidate));
      const baseTarget = targetKey ? data.customTargets[targetKey] : data.globalTarget;
      let adjustedTarget = baseTarget;
      let riskLevel = "GREEN";

      const maladie = last.maladie || "Aucune";
      const intensiteNum = last.intensite || 0;

      if (maladie !== "Aucune") {
        if (intensiteNum >= 10 || !intensiteNum) {
          adjustedTarget -= 1.0;
          riskLevel = "RED";
        } else if (intensiteNum >= 5) {
          adjustedTarget -= 0.5;
          riskLevel = "YELLOW";
        }
      }

      let daysNeeded = 0;
      if (currentDeg < adjustedTarget) {
        daysNeeded = (adjustedTarget - currentDeg) / degrePerDay;
      }

      const projDate = new Date(last.date);
      projDate.setDate(projDate.getDate() + Math.ceil(daysNeeded));

      const isReady = currentDeg >= adjustedTarget || new Date() >= projDate;

      projections.push({
        parcelleId: projectionParcelleId,
        parcelleKey: projectionKey,
        parcelleNom: last.parcelle,
        commune: resolvedParcelle?.commune ?? null,
        region: resolvedParcelle?.region ?? null,
        departement: resolvedParcelle?.departement ?? null,
        cepage: last.cepage,
        proj: {
          currentDeg,
          degrePerDay,
          maladie,
          intensiteNum,
          riskLabel: maladie === "Aucune" ? "Sain" : `${maladie} ${intensiteNum}%`.trim(),
          baseTarget,
          adjustedTarget,
          riskLevel,
          projDate: projDate.toISOString(),
          lastDate: last.date.toISOString(),
          isReady
        }
      });
    }

    return projections;
  }

  // =======================================================
  // 2. RÉCEPTION DES RAISINS (QUAI)
  // =======================================================
  static async createApport(data: z.infer<typeof CreateApportSchema>, organizationId: number) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Cet apport a déjà été enregistré.");

      const apport = await tx.pressing.create({
        data: {
          date: data.date, // String attendu par Prisma
          cru: data.parcelle, 
          cepage: data.cepage,
          weight: data.poids, 
          status: data.status,
          organizationId,
        }
      });

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "CREATE_APPORT" } });
      return { ...apport, parcelle: apport.cru, poids: apport.weight }; // Rétrocompatibilité UI
    });
  }

  // =======================================================
  // 3. GESTION DES MACHINES (PRESSOIRS)
  // =======================================================
  static async createPressoir(data: z.infer<typeof CreatePressoirSchema>, organizationId: number) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Pressoir déjà créé.");

      const p = await tx.pressoir.create({ 
        data: { nom: data.nom, type: data.type, marque: data.marque, capacite: data.capacite, organizationId }
      });

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "CREATE_PRESSOIR" } });
      return p;
    });
  }

  static async updatePressoir(data: z.infer<typeof UpdatePressoirSchema>, organizationId: number) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Pressoir déjà mis à jour.");

      const updateResult = await tx.pressoir.updateMany({
        where: { id: data.id, organizationId },
        data: { 
          status: data.status, 
          loadKg: data.loadKg, 
          parcelle: data.parcelle, 
          cepage: data.cepage
        }
      });

      if (updateResult.count !== 1) {
        throw new Error('Pressoir introuvable.');
      }

      const p = await tx.pressoir.findFirstOrThrow({ where: { id: data.id, organizationId } });

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "UPDATE_PRESSOIR" } });
      return p;
    });
  }
}
