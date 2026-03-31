import { NextResponse } from 'next/server';
import { UpdateLotStatusSchema } from '../../../../validations/lots.schema';
import { LotsService } from '../../../../services/lots.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const payload = { ...body, lotId: parseInt(body.lotId) };

    const validation = UpdateLotStatusSchema.safeParse(payload);
    if (!validation.success) return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });

    const result = await LotsService.updateStatus(validation.data, "system@cave.fr");
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message.includes("ALREADY_APPLIED") ? 400 : 500 });
  }
}
