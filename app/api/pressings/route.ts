import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { CreateApportSchema } from '../../../validations/vendanges.schema';
import { VendangesService } from '../../../services/vendanges.service';

export const dynamic = 'force-dynamic';
const prisma = new PrismaClient();

export async function GET() {
  try {
    const pressings = await prisma.pressing.findMany({ orderBy: { createdAt: 'desc' } });
    const formatted = pressings.map(p => ({ ...p, parcelle: p.cru, poids: p.weight }));
    return NextResponse.json(formatted, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Erreur lecture" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = CreateApportSchema.safeParse(body);
    if (!validation.success) return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    
    const result = await VendangesService.createApport(validation.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    const status = error.message.includes("ALREADY_APPLIED") ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get('id') || "");
    if (isNaN(id)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const existing = await prisma.pressing.findUnique({ where: { id } });
    if (existing && existing.status !== "EN_ATTENTE") {
       return NextResponse.json({ error: "Impossible de supprimer un apport déjà pressé." }, { status: 403 });
    }
    await prisma.pressing.delete({ where: { id } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: "Erreur suppression" }, { status: 500 });
  }
}