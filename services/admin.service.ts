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
import { WorkOrderRepository } from '@/server/modules/workorders/workorder.repository';

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
  cancelledAt: Date | null;
  cancelledBy: string | null;
  cancelReason: string | null;
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
  cancelledAt: workOrder.cancelledAt?.toISOString() || null,
  cancelledBy: workOrder.cancelledBy,
  cancelReason: workOrder.cancelReason,
});

type WorkOrderVolumeSource = { lotId: number; volume: number; role?: string; sourceRole?: string };

const isVolumeSource = (source: any): source is WorkOrderVolumeSource =>
  source && typeof source === 'object' && 'lotId' in source && 'volume' in source;

export class AdminService {
  
  // --- GESTION DES ORDRES DE TRAVAIL ---
  static async createWorkOrder(data: CreateWorkOrderPayload, userEmail: string, organizationId: number) {
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

        const lot = await tx.lot.findFirst({ where: { id: source.lotId, organizationId } });
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
        const targetContainer = await tx.container.findFirst({ where: { id: data.targetContainerId, organizationId } });
        if (!targetContainer) throw new Error("Cuve de destination introuvable.");
        
        const totalIncomingVolume = volumeSources.reduce((sum, s) => sum + s.volume, 0);
        // Tolérance de 5% de débordement théorique tolérée dans la réalité, mais stricte en base
        if (Number(targetContainer.capacityValue) < totalIncomingVolume) {
           throw new Error(`La cuve de destination est trop petite. Capacité: ${targetContainer.capacityValue}hL, Volume prévu: ${totalIncomingVolume}hL`);
        }
      }

      if (data.targetLotId) {
        const targetLot = await tx.lot.findFirst({ where: { id: data.targetLotId, organizationId } });
        if (!targetLot) throw new Error("Lot cible introuvable.");
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
          organizationId,
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
          userId: userEmail,
          organizationId,
        }
      });

      // Retourner un objet formaté pour le frontend
      return { 
        status: "SUCCESS", 
        workOrder: toWorkOrderDto(workOrder)
      };
    });
  }

  static async listWorkOrders(organizationId: number) {
    const workOrders = await prisma.workOrder.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return workOrders.map(toWorkOrderDto);
  }

  static async completeWorkOrder(publicId: string, evidence: unknown, userEmail: string, organizationId: number) {
    return await prisma.$transaction(async (tx) => {
      const workOrder = await tx.workOrder.findFirst({ where: { publicId, organizationId } });
      if (!workOrder) {
        throw new Error('Ordre de travail introuvable.');
      }

      if (workOrder.status === 'DONE') {
        throw new Error('ALREADY_APPLIED: Cet ordre de travail est déjà terminé.');
      }

      if (workOrder.status === 'CANCELLED') {
        throw new Error('WORK_ORDER_CANCELLED: Un ordre de travail annulé ne peut pas être exécuté.');
      }

      const updateResult = await tx.workOrder.updateMany({
        where: { id: workOrder.id, organizationId },
        data: {
          status: 'DONE',
          operator: userEmail,
          executionEvidence: evidence as any,
          executedAt: new Date(),
        },
      });
      if (updateResult.count !== 1) {
        throw new Error('Ordre de travail introuvable.');
      }
      const updated = await tx.workOrder.findFirstOrThrow({ where: { id: workOrder.id, organizationId } });

      await tx.auditLog.create({
        data: {
          action: `WO_EXECUTED_${updated.recette}`,
          details: `Exécuté: ${updated.recette} - ${updated.publicId}`,
          userId: userEmail,
          organizationId,
        },
      });

      return toWorkOrderDto(updated);
    });
  }

  static async cancelWorkOrder(publicId: string, reason: string, userEmail: string, organizationId: number) {
    return prisma.$transaction(async (tx) => {
      const workOrder = await WorkOrderRepository.findByPublicId(tx, publicId, organizationId);

      if (!workOrder) {
        throw new Error('Ordre de travail introuvable.');
      }

      if (workOrder.status === 'DONE') {
        throw new Error('WORK_ORDER_DONE: Un ordre exécuté ne peut pas être annulé.');
      }

      if (workOrder.status === 'CANCELLED') {
        throw new Error('ALREADY_CANCELLED: Cet ordre de travail est déjà annulé.');
      }

      if (workOrder.status !== 'PENDING') {
        throw new Error(`WORK_ORDER_NOT_PENDING: Un ordre au statut ${workOrder.status} ne peut pas être annulé.`);
      }

      const updated = await WorkOrderRepository.cancel(tx, workOrder.id, {
        cancelledAt: new Date(),
        cancelledBy: userEmail,
        cancelReason: reason,
      });

      await WorkOrderRepository.createAuditLog(tx, {
        action: `WO_CANCELLED_${updated.recette}`,
        details: `Annulé: ${updated.recette} - ${updated.publicId} - Motif: ${reason}`,
        userId: userEmail,
        organizationId,
      });

      return toWorkOrderDto(updated);
    });
  }

  // --- GESTION DES UTILISATEURS ---
  static async upsertUser(data: UpsertUserInput, userEmail: string, organizationId: number) {
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
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
      create: {
        organizationId,
        userId: user.id,
        roleKey: data.roleKey,
      },
      update: {
        roleKey: data.roleKey,
      },
    });

    return user;
  }
}
