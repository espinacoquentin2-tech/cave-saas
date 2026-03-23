// app/api/events/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    // 1. Récupération des paramètres envoyés par le Frontend (l'URL)
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50'); // 50 par défaut
    const year = searchParams.get('year'); // Optionnel : ex: "2024"

    // 2. Calcul du décalage (Skip) pour la pagination
    const skip = (page - 1) * limit;

    // 3. Construction du filtre (Where) dynamique
    const whereClause: any = {};
    
    // Si l'utilisateur veut voir une année spécifique
    if (year) {
      whereClause.eventDatetime = {
        gte: new Date(`${year}-01-01T00:00:00.000Z`), // Début de l'année
        lte: new Date(`${year}-12-31T23:59:59.999Z`)  // Fin de l'année
      };
    }

    // 4. Requête optimisée à la base de données
    const events = await prisma.lotEvent.findMany({
      where: whereClause,
      include: {
        lots: true,
        containers: true
      },
      orderBy: { eventDatetime: 'desc' },
      skip: skip,
      take: limit
    });

    // 5. (Optionnel mais recommandé) On compte le total pour dire au frontend s'il y a d'autres pages
    const totalEvents = await prisma.lotEvent.count({ where: whereClause });
    const totalPages = Math.ceil(totalEvents / limit);

    return NextResponse.json({
      data: events,
      meta: {
        total: totalEvents,
        page: page,
        totalPages: totalPages,
        hasMore: page < totalPages
      }
    }, { status: 200 });

  } catch (error) {
    console.error("[EVENTS_API_ERROR]", error);
    return NextResponse.json({ error: "Erreur lors du chargement de l'historique" }, { status: 500 });
  }
}