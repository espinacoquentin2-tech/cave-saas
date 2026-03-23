// app/api/lots/assemblage/route.ts
import { NextResponse } from 'next/server';
import { AssemblageSchema } from '../../../../validations/assemblage.schema';
import { AssemblageService } from '../../../../services/assemblage.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Nettoyage et conversion des types pour la validation Zod
    const payload = {
      ...body,
      millesime: body.millesime === "SA" ? "SA" : parseInt(body.millesime),
      volume: parseFloat(body.volume),
      targetContainerId: parseInt(body.targetContainerId),
      // Nettoyage des tableaux de sources (Vracs et Bouteilles)
      sourceLots: Array.isArray(body.sourceLots) 
        ? body.sourceLots.map((s: any) => ({
            id: parseInt(s.id),
            volumeUsed: parseFloat(s.volumeUsed)
          }))
        : [],
      sourceBottles: Array.isArray(body.sourceBottles)
        ? body.sourceBottles.map((b: any) => ({
            id: parseInt(b.id),
            countUsed: parseInt(b.countUsed),
            format: String(b.format)
          }))
        : []
    };

    // 1. Validation de sécurité stricte
    const validation = AssemblageSchema.safeParse(payload);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    // 2. Exécution de la transaction ACID via le Service
    // NB: En production, remplacez "system@cave.fr" par l'email récupéré via la session utilisateur
    const result = await AssemblageService.execute(validation.data, "system@cave.fr");
    
    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error("[ASSEMBLAGE_API_ERROR]", error);
    const status = error.message.includes("ALREADY_APPLIED") || error.message.includes("insuffisant") ? 400 : 500;
    return NextResponse.json({ error: error.message || "Erreur serveur interne lors de l'assemblage" }, { status });
  }
}