// app/api/bottles/status/route.ts
import { NextResponse } from 'next/server';
import { UpdateBottleStatusSchema } from '../../../../validations/bottles.schema';
import { BottlesService } from '../../../../services/bottles.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Validation stricte Zod
    const validation = UpdateBottleStatusSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }
    
    // Transaction via le Service (Défini dans nos précédentes étapes)
    const result = await BottlesService.updateStatus(validation.data, "system@cave.fr");
    
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("[BOTTLES_STATUS_API_ERROR]", error);
    const status = error.message.includes("ALREADY_APPLIED") ? 400 : 500;
    return NextResponse.json({ error: error.message || "Erreur lors de la mise à jour du statut." }, { status });
  }
}