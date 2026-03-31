// services/admin.service.ts
import { CreateWorkOrderPayload, UserPayload } from '../validations/admin.schema';
import { prisma } from '@/server/shared/prisma';


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
      // Vérifier que les lots sources ont assez de volume
      for (const source of data.sources) {
        const lot = await tx.lot.findUnique({ where: { id: source.lotId } });
        if (!lot) throw new Error(`Lot source ID ${source.lotId} introuvable.`);
        if (Number(lot.currentVolume) < source.volume) {
          throw new Error(`Volume insuffisant dans le lot ${lot.businessCode}. Requis: ${source.volume}, Dispo: ${lot.currentVolume}`);
        }
      }

      // Vérifier la cuve de destination si applicable
      if (data.targetContainerId) {
        const targetContainer = await tx.container.findUnique({ where: { id: data.targetContainerId } });
        if (!targetContainer) throw new Error("Cuve de destination introuvable.");
        
        const totalIncomingVolume = data.sources.reduce((sum, s) => sum + s.volume, 0);
        // Tolérance de 5% de débordement théorique tolérée dans la réalité, mais stricte en base
        if (Number(targetContainer.capacityValue) < totalIncomingVolume) {
           throw new Error(`La cuve de destination est trop petite. Capacité: ${targetContainer.capacityValue}hL, Volume prévu: ${totalIncomingVolume}hL`);
        }
      }

      // 3. PERSISTANCE (À adapter selon votre modèle Prisma réel pour les WorkOrders)
      // Ici, nous créons au minimum une trace d'audit pour marquer la planification
      
      const displayAction = data.details || `Vers cuve ID ${data.targetContainerId}`;
      const totalVolume = data.sources.reduce((sum, s) => sum + s.volume, 0);

      // Traçabilité & Idempotence
      await tx.idempotencyRecord.create({
        data: { key: data.idempotencyKey, action: "CREATE_WORKORDER", userId: userEmail }
      });

      const auditRecord = await tx.auditLog.create({
        data: { 
          action: `WO_PLANIFIED_${data.recette}`, 
          details: `Planifié: ${data.recette} - Vol total: ${totalVolume}hL - ${displayAction}`, 
          userId: userEmail 
        }
      });

      // Retourner un objet formaté pour le frontend
      return { 
        status: "SUCCESS", 
        workOrder: {
          id: `WO-${auditRecord.id}`,
          date: new Date().toISOString(),
          recette: data.recette,
          status: "PENDING",
          volume: totalVolume,
          displayAction: displayAction,
          operator: userEmail
        }
      };
    });
  }

  // --- GESTION DES UTILISATEURS ---
  static async upsertUser(data: UserPayload, userEmail: string) {
    // Vérification sommaire des droits (devrait idéalement être faite dans le contrôleur via la session)
    const currentUser = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!currentUser || !["ADMIN", "CHEF_CAVE"].includes(currentUser.role)) {
      throw new Error("Droits insuffisants pour gérer les utilisateurs.");
    }

    let user;
    if (data.id) {
      // Mise à jour
      user = await prisma.user.update({
        where: { id: data.id },
        data: { name: data.name, email: data.email, role: data.role.toUpperCase().replace(/ /g, '_') }
      });
    } else {
      // Création
      user = await prisma.user.create({
        data: { name: data.name, email: data.email, role: data.role.toUpperCase().replace(/ /g, '_') }
      });
    }
    return user;
  }
}