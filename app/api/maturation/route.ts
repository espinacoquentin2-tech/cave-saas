import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { SaveMaturationSchema } from '../../../validations/maturation.schema';
import { MaturationService } from '../../../services/maturation.service';

export const dynamic = 'force-dynamic';
const prisma = new PrismaClient();

// =========================================================================
// 1. LECTURE (GET) - Votre code conservé pour charger l'historique
// =========================================================================
export async function GET() {
  try {
    const maturations = await prisma.maturation.findMany({
      orderBy: { date: 'asc' }
    });
    return NextResponse.json(maturations);
  } catch (error: any) {
    console.error("ERREUR GET MATURATION :", error);
    return NextResponse.json({ error: "Erreur lecture base de données" }, { status: 500 });
  }
}

// =========================================================================
// 2. CRÉATION & MISE À JOUR (POST SÉCURISÉ)
// =========================================================================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Nettoyage rapide pour Zod (Conversion des chaines vides en undefined)
    const parsedBody = {
      ...body,
      sucre: body.sucre ? parseFloat(body.sucre) : undefined,
      ph: body.ph ? parseFloat(body.ph) : undefined,
      at: body.at ? parseFloat(body.at) : undefined,
      malique: body.malique ? parseFloat(body.malique) : undefined,
      tartrique: body.tartrique ? parseFloat(body.tartrique) : undefined,
      intensite: body.intensite ? parseFloat(body.intensite) : undefined,
    };

    // 1. Validation de sécurité stricte
    const validation = SaveMaturationSchema.safeParse(parsedBody);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    // 2. Exécution dans le Cerveau (Transaction, Calculs, Idempotence, Audit)
    // NB: En production, récupérez l'email depuis la session (ex: getServerSession)
    const result = await MaturationService.saveRecord(validation.data, "system@cave.fr");
    
    // 3. Réponse propre
    return NextResponse.json(result.record, { status: 200 });

  } catch (error: any) {
    console.error("[MATURATION_API_ERROR]", error);
    const status = error.message.includes("ALREADY_APPLIED") ? 400 : 500;
    return NextResponse.json({ error: error.message || "Erreur serveur interne" }, { status });
  }
}

// NB: Plus besoin de PUT, le POST gère l'Upsert grâce au Service !