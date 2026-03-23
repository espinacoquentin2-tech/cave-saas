import { NextResponse } from 'next/server';
import { AddIntrantSchema } from '../../../../validations/lots.schema';
import { LotsService } from '../../../../services/lots.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = AddIntrantSchema.safeParse(body);
    if (!validation.success) return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    
    const result = await LotsService.addIntrant(validation.data, "system@cave.fr");
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    const status = error.message.includes("ALREADY_APPLIED") || error.message.includes("AOC:") ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}