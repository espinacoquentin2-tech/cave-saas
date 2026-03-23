// app/api/tracabilite/route.ts
import { NextResponse } from 'next/server';
import { TraceabilityRequestSchema } from '../../../validations/tracabilite.schema';
import { TracabiliteService } from '../../../services/tracabilite.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const validation = TraceabilityRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const lineage = await TracabiliteService.getLineage(validation.data);
    
    return NextResponse.json(lineage, { status: 200 });

  } catch (error: any) {
    console.error("[TRACABILITE_API_ERROR]", error);
    return NextResponse.json({ error: error.message || "Erreur serveur interne" }, { status: 500 });
  }
}