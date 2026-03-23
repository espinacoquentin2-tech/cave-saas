import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const parcelles = await prisma.parcelle.findMany({ orderBy: { nom: 'asc' } });
    return NextResponse.json(parcelles);
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const p = await prisma.parcelle.create({ 
      data: { 
        nom: body.nom,
        departement: body.departement,
        region: body.region,
        commune: body.commune
      } 
    });
    return NextResponse.json(p);
  } catch (e) {
    return NextResponse.json({ error: "Parcelle déjà existante ou erreur" }, { status: 400 });
  }
}