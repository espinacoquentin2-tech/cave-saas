import { NextResponse } from 'next/server';
import { HabillerSchema } from '../../../../validations/bottles.schema';
import { BottlesService } from '../../../../services/bottles.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = HabillerSchema.safeParse(body);
    if (!validation.success) return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    
    const result = await BottlesService.habiller(validation.data, "system@cave.fr");
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message.includes("ALREADY_APPLIED") ? 400 : 500 });
  }
}