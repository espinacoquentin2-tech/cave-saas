import { NextResponse } from 'next/server';
import { SaveFaTourSchema } from '../../../validations/lots.schema';
import { LotsService } from '../../../services/lots.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Nettoyage passif des données (conversion strings en numbers)
    const payload = {
      idempotencyKey: body.idempotencyKey,
      readings: Array.isArray(body.readings) ? body.readings.map((r: any) => ({
        lotId: parseInt(r.lotId),
        date: r.date,
        density: r.density ? parseFloat(r.density) : undefined,
        temperature: r.temperature ? parseFloat(r.temperature) : undefined
      })) : []
    };

    // 1. Validation de sécurité
    const validation = SaveFaTourSchema.safeParse(payload);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }
    
    // 2. Exécution métier 
    // NB: Remplacer "system@cave.fr" par la session utilisateur
    const result = await LotsService.saveFaTour(validation.data, "system@cave.fr");
    
    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error("[FA_API_ERROR]", error);
    const status = error.message.includes("ALREADY_APPLIED") ? 400 : 500;
    return NextResponse.json({ error: error.message || "Erreur serveur" }, { status });
  }
}