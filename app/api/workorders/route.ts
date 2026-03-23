import { NextResponse } from 'next/server';
import { CreateWorkOrderSchema } from '../../../validations/admin.schema';
import { AdminService } from '../../../services/admin.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Nettoyage et conversion des types pour Zod
    const parsedBody = {
      ...body,
      targetContainerId: body.targetContainerId ? parseInt(body.targetContainerId) : undefined,
      targetLotId: body.targetLotId ? parseInt(body.targetLotId) : undefined,
      sources: body.sources ? body.sources.map((s: any) => ({
        lotId: parseInt(s.lotId),
        volume: parseFloat(s.volume)
      })) : []
    };

    const validation = CreateWorkOrderSchema.safeParse(parsedBody);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const result = await AdminService.createWorkOrder(validation.data, "system@cave.fr"); // Remplacer par session utilisateur
    
    return NextResponse.json(result.workOrder, { status: 200 });

  } catch (error: any) {
    console.error("[WORKORDER_API_ERROR]", error);
    const status = error.message.includes("ALREADY_APPLIED") || error.message.includes("insuffisant") ? 400 : 500;
    return NextResponse.json({ error: error.message || "Erreur serveur interne" }, { status });
  }
}