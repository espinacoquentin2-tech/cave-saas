import { NextResponse } from 'next/server';
import { LoadPressSchema } from '../../../../validations/pressings.schema';
import { PressingService } from '../../../../services/pressings.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = LoadPressSchema.safeParse(body);
    if (!validation.success) return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    
    const result = await PressingService.load(validation.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    const status = error.message.includes("ALREADY_APPLIED") ? 400 : (error.message.includes("MIX_WARNING") ? 409 : 500);
    return NextResponse.json({ error: error.message }, { status });
  }
}