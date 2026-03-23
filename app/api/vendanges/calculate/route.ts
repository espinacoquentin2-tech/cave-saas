// app/api/vendanges/calculate/route.ts
import { NextResponse } from 'next/server';
import { ProjectionsRequestSchema } from '../../../../validations/vendanges.schema';
import { VendangesService } from '../../../../services/vendanges.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 1. Validation stricte des cibles envoyées par le client
    const validation = ProjectionsRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    // 2. Calcul des prédictions
    const projections = await VendangesService.calculateProjections(validation.data);
    
    return NextResponse.json(projections, { status: 200 });

  } catch (error: any) {
    console.error("[VENDANGES_CALC_ERROR]", error);
    return NextResponse.json({ error: "Erreur interne lors du calcul des prédictions" }, { status: 500 });
  }
}