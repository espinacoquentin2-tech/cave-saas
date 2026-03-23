// app/api/tirage/route.ts
import { NextResponse } from 'next/server';
import { TirageSchema } from '../../../validations/tirage.schema';
import { TirageService } from '../../../services/tirage.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Nettoyage et conversion pour la validation Zod
    const payload = {
      ...body,
      lotId: body.lotId ? parseInt(body.lotId) : undefined,
      count: body.count ? parseInt(body.count) : undefined,
      volume: body.volume ? parseFloat(body.volume) : undefined,
    };

    // 1. Validation de sécurité stricte
    const validation = TirageSchema.safeParse(payload);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    // 2. Exécution de la transaction ACID via le Service
    // NB: Remplacer "system@cave.fr" par la session utilisateur
    const result = await TirageService.executeTirage(validation.data, "system@cave.fr");
    
    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error("[TIRAGE_API_ERROR]", error);
    const status = error.message.includes("ALREADY_APPLIED") || error.message.includes("insuffisant") ? 400 : 500;
    return NextResponse.json({ error: error.message || "Erreur serveur interne lors du tirage" }, { status });
  }
}