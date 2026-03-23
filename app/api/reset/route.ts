import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST() {
  try {
    // TRANSACTION ATOMIQUE : Tout passe ou tout échoue
    await prisma.$transaction(async (tx) => {
      // 1. Supprimer les relations de traçabilité en premier (Clés étrangères)
      await tx.lotEventLot.deleteMany();
      await tx.lotEventContainer.deleteMany();
      await tx.lotEvent.deleteMany();
      await tx.faReading.deleteMany();
      await tx.stockMovement.deleteMany();
      await tx.idempotencyRecord.deleteMany();
      await tx.degustation.deleteMany();

      // 2. Supprimer les lots (Vrac et Bouteilles)
      await tx.bottleLot.deleteMany();
      await tx.lot.deleteMany();

      // 3. Supprimer les données de campagne
      await tx.pressing.deleteMany();
      await tx.pressoir.deleteMany();
      await tx.maturation.deleteMany();

      // 4. RÉINITIALISATION PHYSIQUE (On garde les structures mais vide le contenu)
      // On remet les stocks à 0
      await tx.product.updateMany({
        data: { currentStock: 0 }
      });

      // On vide les cuves
      await tx.container.updateMany({
        data: { 
          status: 'VIDE',
          notes: null
        }
      });
    });

    return NextResponse.json({ 
      success: true, 
      message: "Réinitialisation complète effectuée. Base de données synchronisée." 
    }, { status: 200 });

  } catch (error: any) {
    console.error("[CRITICAL_RESET_ERROR]", error);
    return NextResponse.json({ 
      error: "Échec de la réinitialisation : " + error.message 
    }, { status: 500 });
  }
}