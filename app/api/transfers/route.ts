// app/api/transfers/route.ts
import { NextResponse } from 'next/server';
import { TransferSchema } from '../../../validations/cuverie.schema';
import { CuverieService } from '../../../services/cuverie.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Nettoyage et conversion des types avant validation Zod
    const payload = {
      ...body,
      lotId: body.lotId ? parseInt(body.lotId) : undefined,
      fromId: body.fromId ? parseInt(body.fromId) : undefined,
      volume: body.volume ? parseFloat(body.volume) : undefined,
      ph: body.ph ? parseFloat(body.ph) : undefined,
      at: body.at ? parseFloat(body.at) : undefined,
      tavp: body.tavp ? parseFloat(body.tavp) : undefined,
      destinations: Array.isArray(body.destinations) 
        ? body.destinations.map((d: any) => ({
            toId: parseInt(d.toId),
            volume: parseFloat(d.volume)
          }))
        : []
    };

    // 1. Validation de sécurité stricte
    const validation = TransferSchema.safeParse(payload);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    // 2. Exécution de la transaction ACID via le Service
    // NB: Remplacer "system@cave.fr" par l'email de l'utilisateur connecté via la session (getServerSession)
    const result = await CuverieService.executeTransfer(validation.data, "system@cave.fr");
    
    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error("[TRANSFER_API_ERROR]", error);
    const status = error.message.includes("ALREADY_APPLIED") || error.message.includes("insuffisant") ? 400 : 500;
    return NextResponse.json({ error: error.message || "Erreur serveur interne lors du transfert" }, { status });
  }
}