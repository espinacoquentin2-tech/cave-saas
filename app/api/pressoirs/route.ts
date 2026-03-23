import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { CreatePressoirSchema, UpdatePressoirSchema } from '../../../validations/vendanges.schema';
import { VendangesService } from '../../../services/vendanges.service';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const pressoirs = await prisma.pressoir.findMany({ orderBy: { nom: 'asc' } });
    return NextResponse.json(pressoirs);
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = CreatePressoirSchema.safeParse(body);
    if (!validation.success) return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    const result = await VendangesService.createPressoir(validation.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message.includes("ALREADY_APPLIED") ? 400 : 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const validation = UpdatePressoirSchema.safeParse(body);
    if (!validation.success) return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    const result = await VendangesService.updatePressoir(validation.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message.includes("ALREADY_APPLIED") ? 400 : 500 });
  }
}