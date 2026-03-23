// services/vendanges.service.ts
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { 
  ProjectionsRequestPayload, 
  CreateApportSchema, 
  CreatePressoirSchema, 
  UpdatePressoirSchema 
} from '../validations/vendanges.schema';

const prisma = new PrismaClient();

export class VendangesService {
  
  // =======================================================
  // 1. CALCULS DES PRÉVISIONS DE VENDANGES (OAD)
  // =======================================================
  static async calculateProjections(data: ProjectionsRequestPayload) {
    const maturations = await prisma.maturation.findMany({
      orderBy: { date: 'asc' }
    });

    const groupedMaturations: Record<string, any[]> = {};
    for (const m of maturations) {
      const key = `${m.parcelle}_${m.cepage}`;
      if (!groupedMaturations[key]) groupedMaturations[key] = [];
      groupedMaturations[key].push(m);
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

      const baseTarget = data.customTargets[last.parcelle] || data.globalTarget;
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
        parcelleNom: last.parcelle,
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
  static async createApport(data: z.infer<typeof CreateApportSchema>) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Cet apport a déjà été enregistré.");

      const apport = await tx.pressing.create({
        data: {
          date: data.date, // String attendu par Prisma
          cru: data.parcelle, 
          cepage: data.cepage,
          weight: data.poids, 
          status: data.status
        }
      });

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "CREATE_APPORT" } });
      return { ...apport, parcelle: apport.cru, poids: apport.weight }; // Rétrocompatibilité UI
    });
  }

  // =======================================================
  // 3. GESTION DES MACHINES (PRESSOIRS)
  // =======================================================
  static async createPressoir(data: z.infer<typeof CreatePressoirSchema>) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Pressoir déjà créé.");

      const p = await tx.pressoir.create({ 
        data: { nom: data.nom, type: data.type, marque: data.marque, capacite: data.capacite } 
      });

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "CREATE_PRESSOIR" } });
      return p;
    });
  }

  static async updatePressoir(data: z.infer<typeof UpdatePressoirSchema>) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Pressoir déjà mis à jour.");

      const p = await tx.pressoir.update({
        where: { id: data.id },
        data: { 
          status: data.status, 
          loadKg: data.loadKg, 
          parcelle: data.parcelle, 
          cepage: data.cepage
        }
      });

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "UPDATE_PRESSOIR" } });
      return p;
    });
  }
}