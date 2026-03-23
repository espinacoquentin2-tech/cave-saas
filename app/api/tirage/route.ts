// app/api/tirage/route.ts
import { NextResponse } from 'next/server';
import { TirageSchema } from '../../../validations/tirage.schema';
import { TirageService } from '../../../services/tirage.service';
import { BusinessLogicError } from '../../../lib/errors';

export async function POST(req: Request) {
  try {
    // NB: En production réelle, on récupérera l'utilisateur via la session
    const userEmail = "system@cave.fr";

    const body = await req.json();
    
    // 1. Validation stricte et conversion automatique via Zod (z.coerce fait le travail de parseInt/parseFloat)
    const payload = TirageSchema.parse(body);

    // 2. Exécution métier
    const result = await TirageService.executeTirage(payload, userEmail);
    
    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error("[TIRAGE_API_ERROR]", error);
    
    // Erreur de validation des données (ex: volume négatif envoyé par un hackeur, ou texte à la place d'un chiffre)
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    
    // Erreur métier (ex: pas assez de vin dans la cuve, double-clic)
    if (error instanceof BusinessLogicError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    // Erreur système imprévue (Base de données hors ligne, etc.)
    return NextResponse.json({ error: "Erreur serveur interne lors du tirage." }, { status: 500 });
  }
}