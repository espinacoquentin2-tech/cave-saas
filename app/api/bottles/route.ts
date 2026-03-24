import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const bottles = await prisma.bottleLot.findMany();
    return NextResponse.json(bottles);
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de la lecture des bouteilles" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '0');

    await prisma.$transaction(async (tx) => {
      const bottleLot = await tx.bottleLot.findUnique({ where: { id } });
      if (!bottleLot) return;

      // 1. Nettoyer les liens d'historique
      await tx.bottleEventLink.deleteMany({ where: { bottleLotId: id } });

      // 2. Restituer le vin dans la cuve d'origine !
      if (bottleLot.sourceLotId) {
        const fmtHL = { "37.5cl":0.00375, "75cl":0.0075, "150cl":0.015, "300cl":0.03 };
        const volumeToRestore = bottleLot.initialBottleCount * (fmtHL[bottleLot.formatCode as keyof typeof fmtHL] || 0.0075);
        
        const lot = await tx.lot.findUnique({ where: { id: bottleLot.sourceLotId } });
        if (lot) {
          await tx.lot.update({
            where: { id: bottleLot.sourceLotId },
            data: { 
              currentVolume: Number(lot.currentVolume) + volumeToRestore,
              status: lot.status === 'TIRE' ? 'ACTIF' : lot.status // Réanime le lot s'il était fini
            }
          });
        }
      }

      // 3. Détruire le lot de bouteilles
      await tx.bottleLot.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}