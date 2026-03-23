// app/api/analyses/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { SaveAnalysesSchema } from '../../../validations/analyses.schema';
import { AnalysesService } from '../../../services/analyses.service';

export const dynamic = 'force-dynamic';
const prisma = new PrismaClient();

// LECTURE (GET)
export async function GET() {
  try {
    const records = await prisma.analysis.findMany({
      orderBy: { analysisDate: 'desc' }
    });
    return NextResponse.json(records);
  } catch (error: any) {
    return NextResponse.json({ error: "Erreur lecture base de données" }, { status: 500 });
  }
}

// CRÉATION MULTIPLE (POST) - Gère la saisie manuelle ET l'import IA
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Nettoyage et récupération des données exotiques de l'IA
    const cleanedAnalyses = body.analyses.map((a: any) => {
      // On isole les champs connus de la table, et TOUT le reste va dans "extra"
      const { 
        lotId, analysisDate, ph, at, so2Free, so2Total, alcohol, notes, 
        // On exclut les variables purement frontend si elles ont glissé ici
        _ok, _id, 
        ...extra 
      } = a;

      return {
        lotId: lotId ? parseInt(lotId) : undefined,
        analysisDate: analysisDate,
        ph: ph ? parseFloat(ph.toString().replace(',', '.')) : undefined,
        at: at ? parseFloat(at.toString().replace(',', '.')) : undefined,
        so2Free: so2Free ? parseFloat(so2Free.toString().replace(',', '.')) : undefined,
        so2Total: so2Total ? parseFloat(so2Total.toString().replace(',', '.')) : undefined,
        alcohol: alcohol ? parseFloat(alcohol.toString().replace(',', '.')) : undefined,
        notes: notes || undefined,
        // LE TIROIR MAGIQUE : On y remet toutes les données exotiques de l'IA (ex: bretts: 0.5)
        extraData: Object.keys(extra).length > 0 ? extra : undefined 
      };
    });

    const payload = {
      analyses: cleanedAnalyses,
      idempotencyKey: body.idempotencyKey
    };

    // La validation Zod laissera passer `extraData` grâce à `z.record(z.any())` qu'on y a mis
    const validation = SaveAnalysesSchema.safeParse(payload);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const result = await AnalysesService.saveRecords(validation.data, "system@cave.fr");
    
    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error("[ANALYSES_API_ERROR]", error);
    const status = error.message.includes("ALREADY_APPLIED") || error.message.includes("n'existent pas") ? 400 : 500;
    return NextResponse.json({ error: error.message || "Erreur serveur interne" }, { status });
  }
}