// app/api/degustations/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { SaveDegustationSchema } from '../../../validations/degustation.schema';
import { DegustationService } from '../../../services/degustation.service';

export const dynamic = 'force-dynamic';
const prisma = new PrismaClient();

// 1. LECTURE (GET) DE L'HISTORIQUE
export async function GET() {
  try {
    const records = await prisma.degustation.findMany({
      orderBy: { date: 'desc' }
    });
    return NextResponse.json(records);
  } catch (error: any) {
    return NextResponse.json({ error: "Erreur lecture base de données" }, { status: 500 });
  }
}

// 2. CRÉATION (POST SÉCURISÉ)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Nettoyage rapide pour Zod
    const parsedBody = {
      ...body,
      noteGlobale: body.noteGlobale ? parseFloat(body.noteGlobale) : undefined,
      sucreTest: body.sucreTest ? parseFloat(body.sucreTest) : undefined,
    };

    const validation = SaveDegustationSchema.safeParse(parsedBody);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const result = await DegustationService.saveRecord(validation.data, "system@cave.fr");
    
    return NextResponse.json(result.record, { status: 200 });

  } catch (error: any) {
    console.error("[DEGUSTATION_API_ERROR]", error);
    const status = error.message.includes("ALREADY_APPLIED") ? 400 : 500;
    return NextResponse.json({ error: error.message || "Erreur serveur interne" }, { status });
  }
}