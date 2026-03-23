// app/api/transfers/route.ts
import { NextResponse } from 'next/server';
import { TransferSchema } from '../../../validations/cuverie.schema';
import { CuverieService } from '../../../services/cuverie.service';
import { BusinessLogicError } from '../../../lib/errors';

export async function POST(req: Request) {
  try {
    // NB: En production réelle, on récupérera l'utilisateur via la session
    const userEmail = "system@cave.fr";

    const body = await req.json();
    
    // 1. Validation de sécurité stricte et coercition via Zod
    const payload = TransferSchema.parse(body);

    // 2. Exécution de la transaction ACID via le Service
    const result = await CuverieService.executeTransfer(payload, userEmail);
    
    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error("[TRANSFER_API_ERROR]", error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    
    if (error instanceof BusinessLogicError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Erreur serveur interne lors du transfert" }, { status: 500 });
  }
}