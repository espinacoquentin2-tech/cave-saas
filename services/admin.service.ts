// services/admin.service.ts
import { randomUUID } from 'crypto';
import { CreateWorkOrderPayload } from '../validations/admin.schema';
import { formatRoleLabel, normalizeRoleKey } from '@/lib/roles';
import {
  getWorkOrderAssemblageSourceRoleForStatus,
  getWorkOrderAssemblageSourceRoleLabel,
  normalizeWorkOrderAssemblageSourceRole,
} from '@/lib/workorder-assemblage-sources';
import type { UpsertUserInput } from '@/server/modules/users/user.schemas';
import { prisma } from '@/server/shared/prisma';

const toWorkOrderDto = (workOrder: {
  id: number;
  publicId: string;
  recette: string;
  status: string;
  targetContainerId: number | null;
  targetLotId: number | null;
  details: string | null;
  sources: unknown;
  plannedVolume: unknown;
  createdBy: string | null;
  operator: string | null;
  executionEvidence: unknown | null;
  executedAt: Date | null;
  createdAt: Date;
}) => ({
  id: workOrder.publicId,
  dbId: workOrder.id,
  date: workOrder.createdAt.toISOString(),
  recette: workOrder.recette,
  status: workOrder.status,
  targetContainerId: workOrder.targetContainerId,
  targetLotId: workOrder.targetLotId,
  details: workOrder.details,
  sources: Array.isArray(workOrder.sources) ? workOrder.sources : [],
  volume: Number(workOrder.plannedVolume || 0),
  displaySource: Array.isArray(workOrder.sources)
    ? workOrder.sources
        .map((source: any) => {
          if (source?.kind === 'INTRANT') {
            return `Lot #${workOrder.targetLotId}`;
          }

          const role = normalizeWorkOrderAssemblageSourceRole(source?.role ?? source?.sourceRole);
          const roleLabel = workOrder.recette === 'ASSEMBLAGE' ? ` - ${getWorkOrderAssemblageSourceRoleLabel(role)}` : '';
          return `Lot #${source.lotId}${roleLabel} (${source.volume} hL)`;
        })
        .join(', ')
    : null,
  displayAction: workOrder.details || (workOrder.targetContainerId ? `Vers cuve ID ${workOrder.targetContainerId}` : 'Opération planifiée'),
  operator: workOrder.operator || workOrder.createdBy,
  createdBy: workOrder.createdBy,
  executionEvidence: workOrder.executionEvidence,
  executedAt: workOrder.executedAt?.toISOString() || null,
});

type WorkOrderVolumeSource = { lotId: number; volume: number; role?: string; sourceRole?: string };

const isVolumeSource = (source: any): source is WorkOrderVolumeSource =>
  source && typeof source === 'object' && 'lotId' in source && 'volume' in source;

export class AdminService {
  
  // --- GESTION DES ORDRES DE TRAVAIL ---
  static async createWorkOrder(data: CreateWorkOrderPayload, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. IDEMPOTENCE
      const existingTx = await tx.idempotencyRecord.findUnique({
        where: { key: data.idempotencyKey }
      });
      if (existingTx) {
        throw new Error("ALREADY_APPLIED: Cet ordre de travail a déjà été planifié.");
      }

      // 2. CONTRÔLES MÉTIER PRÉVENTIFS
      const isIntrantOrder = !["SOUTIRAGE", "ASSEMBLAGE", "TIRAGE"].includes(data.recette);
      const normalizedSources = [...data.sources];
      const isAssemblageOrder = data.recette === "ASSEMBLAGE";

      // Vérifier que les lots sources ont assez de volume
      for (const [index, source] of normalizedSources.entries()) {
        if (!isVolumeSource(source)) {
          continue;
        }

        const lot = await tx.lot.findUnique({ where: { id: source.lotId } });
        if (!lot) throw new Error(`Lot source ID ${source.lotId} introuvable.`);
        if (Number(lot.currentVolume) < source.volume) {
          throw new Error(`Volume insuffisant dans le lot ${lot.businessCode}. Requis: ${source.volume}, Dispo: ${lot.currentVolume}`);
        }

        if (isAssemblageOrder) {
          const expectedRole = getWorkOrderAssemblageSourceRoleForStatus(lot.status);
          const storedRole = normalizeWorkOrderAssemblageSourceRole(source.role ?? source.sourceRole);

          if (!expectedRole) {
            throw new Error(`Le lot ${lot.businessCode} ne peut pas etre utilise dans un ordre d'assemblage avec le statut ${lot.status}.`);
          }

          if (storedRole && storedRole !== expectedRole) {
            throw new Error(`Role incoherent pour le lot ${lot.businessCode}: ${storedRole} avec statut ${lot.status}. Role attendu: ${expectedRole}.`);
          }

          normalizedSources[index] = {
            ...source,
            role: storedRole ?? expectedRole,
          };
        }
      }

      const volumeSources: WorkOrderVolumeSource[] = [];
      for (const source of normalizedSources) {
        if (isVolumeSource(source)) {
          volumeSources.push(source);
        }
      }

      // Vérifier la cuve de destination si applicable
      if (data.targetContainerId) {
        const targetContainer = await tx.container.findUnique({ where: { id: data.targetContainerId } });
        if (!targetContainer) throw new Error("Cuve de destination introuvable.");
        
        const totalIncomingVolume = volumeSources.reduce((sum, s) => sum + s.volume, 0);
        // Tolérance de 5% de débordement théorique tolérée dans la réalité, mais stricte en base
        if (Number(targetContainer.capacityValue) < totalIncomingVolume) {
           throw new Error(`La cuve de destination est trop petite. Capacité: ${targetContainer.capacityValue}hL, Volume prévu: ${totalIncomingVolume}hL`);
        }
      }

      // 3. PERSISTANCE (À adapter selon votre modèle Prisma réel pour les WorkOrders)
      // Ici, nous créons au minimum une trace d'audit pour marquer la planification
      
      const displayAction = data.details || `Vers cuve ID ${data.targetContainerId}`;
      const totalVolume = isIntrantOrder ? 0 : volumeSources.reduce((sum, s) => sum + s.volume, 0);

      // Traçabilité & Idempotence
      await tx.idempotencyRecord.create({
        data: { key: data.idempotencyKey, action: "CREATE_WORKORDER", userId: userEmail }
      });

      const workOrder = await tx.workOrder.create({
        data: {
          publicId: `WO-${randomUUID()}`,
          recette: data.recette,
          targetContainerId: data.targetContainerId ?? null,
          targetLotId: data.targetLotId ?? null,
          details: data.details?.trim() || null,
          sources: normalizedSources,
          plannedVolume: totalVolume,
          createdBy: userEmail,
          operator: userEmail,
        },
      });

      await tx.auditLog.create({
        data: { 
          action: `WO_PLANIFIED_${data.recette}`, 
          details: `Planifié: ${data.recette} - ${workOrder.publicId} - Vol total: ${totalVolume}hL - ${displayAction}`,
          userId: userEmail 
        }
      });

      // Retourner un objet formaté pour le frontend
      return { 
        status: "SUCCESS", 
        workOrder: toWorkOrderDto(workOrder)
      };
    });
  }

  static async listWorkOrders() {
    const workOrders = await prisma.workOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return workOrders.map(toWorkOrderDto);
  }

  static async completeWorkOrder(publicId: string, evidence: unknown, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      const workOrder = await tx.workOrder.findUnique({ where: { publicId } });
      if (!workOrder) {
        throw new Error('Ordre de travail introuvable.');
      }

      if (workOrder.status === 'DONE') {
        throw new Error('ALREADY_APPLIED: Cet ordre de travail est déjà terminé.');
      }

      const updated = await tx.workOrder.update({
        where: { publicId },
        data: {
          status: 'DONE',
          operator: userEmail,
          executionEvidence: evidence as any,
          executedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          action: `WO_EXECUTED_${updated.recette}`,
          details: `Exécuté: ${updated.recette} - ${updated.publicId}`,
          userId: userEmail,
        },
      });

      return toWorkOrderDto(updated);
    });
  }

  // --- GESTION DES UTILISATEURS ---
  static async upsertUser(data: UpsertUserInput, userEmail: string) {
    // Vérification sommaire des droits (devrait idéalement être faite dans le contrôleur via la session)
    const currentUser = await prisma.user.findUnique({ where: { email: userEmail } });
    const currentUserRoleKey = currentUser
      ? normalizeRoleKey(currentUser.roleKey) ?? normalizeRoleKey(currentUser.role)
      : null;

    if (!currentUserRoleKey || !["ADMIN", "CHEF_CAVE"].includes(currentUserRoleKey)) {
      throw new Error("Droits insuffisants pour gérer les utilisateurs.");
    }

    const persistedUser = {
      name: data.name,
      email: data.email,
      role: data.role || formatRoleLabel(data.roleKey),
      roleKey: data.roleKey,
    };

    let user;
    if (data.id) {
      // Mise à jour
      user = await prisma.user.update({
        where: { id: data.id },
        data: persistedUser
      });
    } else {
      // Création
      user = await prisma.user.create({
        data: persistedUser
      });
    }
    return user;
  }
}
