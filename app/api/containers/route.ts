// app/api/containers/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. LIRE LES CUVES (Sans les archivées)
export async function GET() {
  try {
    const containers = await prisma.container.findMany({
      where: { status: { not: "ARCHIVÉE" } },
      include: { currentLots: true }
    });
    return NextResponse.json(containers, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Erreur de lecture des cuves" }, { status: 500 });
  }
}

// 2. CRÉER UNE CUVE
export async function POST(req: Request) {
  try {
    const body = await req.json(); 
    
    // NB: On pourrait ajouter Zod ici pour une sécurité maximale
    const newContainer = await prisma.container.create({
      data: {
        code: body.code || body.name || body.displayName || "CUVE-X", 
        displayName: body.displayName || body.name || "Nouvelle Cuve",
        type: body.type || "Cuve",
        capacityValue: body.capacityValue ? parseFloat(body.capacityValue) : parseFloat(body.capacity || 0),
        capacityUnit: "hL",
        zone: body.zone || "Cuverie",
        status: body.status || "VIDE",
        notes: body.notes || ""
      }
    });

    return NextResponse.json(newContainer, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: "Erreur lors de la création de la cuve" }, { status: 400 });
  }
}

// 3. MODIFIER UNE CUVE (Statut ou Nom) - NOUVEAU !
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, status, name } = body;

    if (!id) return NextResponse.json({ error: "ID requis." }, { status: 400 });

    const dataToUpdate: any = {};
    if (status) dataToUpdate.status = status;
    if (name) dataToUpdate.displayName = name;

    const updatedContainer = await prisma.container.update({
      where: { id: parseInt(id) },
      data: dataToUpdate
    });

    return NextResponse.json({ success: true, container: updatedContainer }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: "Erreur lors de la mise à jour." }, { status: 500 });
  }
}

// 4. SUPPRIMER / ARCHIVER UNE CUVE
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    const containerId = parseInt(id, 10);

    try {
      await prisma.container.delete({ where: { id: containerId } });
      return NextResponse.json({ success: true, note: "Cuve détruite" }, { status: 200 });
    } catch (dbError: any) {
      // Si la cuve a un historique (clé étrangère), Prisma bloque la suppression. On l'archive à la place.
      if (dbError.code === 'P2003') {
        await prisma.container.update({
          where: { id: containerId },
          data: { status: "ARCHIVÉE" }
        });
        return NextResponse.json({ success: true, note: "Cuve archivée" }, { status: 200 });
      }
      throw dbError;
    }
  } catch (error: any) {
    return NextResponse.json({ error: "Erreur de suppression." }, { status: 500 });
  }
}