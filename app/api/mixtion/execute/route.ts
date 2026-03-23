import { NextResponse } from 'next/server';
import { ExecuteMixtionSchema } from '../../../../validations/tirage.schema';
import { TirageService } from '../../../../services/tirage.service'; // <-- Vérifiez bien que le fichier n'a pas de "s" à service !

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 1. Validation des données avec Zod
    const validation = ExecuteMixtionSchema.safeParse(body);
    if (!validation.success) {
      // CORRECTION : On utilise .issues au lieu de .errors pour TypeScript
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    // 2. Exécution du service métier
    const result = await TirageService.executeMixtion(validation.data, "system@cave.fr");
    
    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error("[MIXTION_API_ERROR]", error);
    // Si c'est une erreur métier gérée (ex: Stock insuffisant), on renvoie 400. Sinon 500.
    const status = error.message.includes("ALREADY_APPLIED") || error.message.includes("insuffisant") ? 400 : 500;
    return NextResponse.json({ error: error.message || "Erreur serveur interne" }, { status });
  }
}