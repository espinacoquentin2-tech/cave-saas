import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { CreateLotSchema } from '../../../validations/lots.schema';
import { LotsService } from '../../../services/lots.service';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const lots = await prisma.lot.findMany();
    return NextResponse.json(lots);
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de la lecture des lots" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const payload = { ...body, volume: parseFloat(body.volume), containerId: parseInt(body.containerId) };
    
    const validation = CreateLotSchema.safeParse(payload);
    if (!validation.success) return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    
    const result = await LotsService.createLot(validation.data, "system@cave.fr");
    return NextResponse.json(result.lot, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message.includes("ALREADY_APPLIED") ? 400 : 500 });
  }
}