// app/api/lots/decuvage/route.ts
import { NextResponse } from 'next/server';
import { DecuvageSchema } from '../../../../validations/cuverie.schema';
import { CuverieService } from '../../../../services/cuverie.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Nettoyage et conversion des types pour Zod
    const payload = {
      ...body,
      sourceLotId: body.sourceLotId ? parseInt(body.sourceLotId) : undefined,
      sourceContainerId: body.sourceContainerId ? parseInt(body.sourceContainerId) : undefined,
      volGoutte: body.volGoutte ? parseFloat(body.volGoutte) : 0,
      volPresse: body.volPresse ? parseFloat(body.volPresse) : 0,
      cuveGoutteId: body.cuveGoutteId ? parseInt(body.cuveGoutteId) : undefined,
      cuvePresseId: body.cuvePresseId ? parseInt(body.cuvePresseId) : undefined,
    };

    // 1. Validation de sécurité stricte
    const validation = DecuvageSchema.safeParse(payload);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    // 2. Exécution de la transaction ACID via le Service
    // NB: Remplacer "system@cave.fr" par la session utilisateur
    const result = await CuverieService.executeDecuvage(validation.data, "system@cave.fr");
    
    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error("[DECUVAGE_API_ERROR]", error);
    const status = error.message.includes("ALREADY_APPLIED") || error.message.includes("introuvable") ? 400 : 500;
    return NextResponse.json({ error: error.message || "Erreur serveur interne lors du décuvage" }, { status });
  }
}