import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    await prisma.$transaction(async (tx) => {
      // 1. Mettre à jour le statut dans la base de données
      await tx.lot.update({
        where: { id: parseInt(body.lotId) },
        data: { status: body.newStatus }
      });

      // 2. Récupérer l'utilisateur (Pour l'audit)
      const user = await tx.user.findFirst();
      
      // 3. Créer l'événement dans le journal d'audit
      const lEvent = await tx.lotEvent.create({
        data: {
          eventType: 'CHANGEMENT_STATUT',
          operatorUserId: user?.id || 1,
          comment: `Nouveau statut : ${body.newStatus.replace(/_/g, " ")}${body.note ? ' - ' + body.note : ''}`,
        }
      });

      // 4. Lier cet événement spécifiquement à ce lot de vin (Correction ici : lotEventLot !)
      await tx.lotEventLot.create({
        data: {
          eventId: lEvent.id,
          lotId: parseInt(body.lotId),
          roleInEvent: 'CIBLE',
          volumeChange: 0
        }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}