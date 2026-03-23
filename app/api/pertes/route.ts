// app/api/pertes/route.ts
import { NextResponse } from 'next/server';
import { ExecuteLossSchema } from '../../../validations/loss.schema';
import { LossService } from '../../../services/loss.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 1. Validation Zod stricte
    const validation = ExecuteLossSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    // 2. Exécution Transactionnelle
    const result = await LossService.executeLoss(validation.data, "system@cave.fr"); // Remplacer par la session utilisateur réelle
    
    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error("[LOSS_API_ERROR]", error);
    const status = error.message.includes("ALREADY_APPLIED") || error.message.includes("insuffisant") ? 400 : 500;
    return NextResponse.json({ error: error.message || "Erreur serveur interne" }, { status });
  }
}