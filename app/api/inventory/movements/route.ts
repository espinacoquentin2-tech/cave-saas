import { NextResponse } from 'next/server';
import { StockMovementSchema } from '../../../../validations/inventory.schema';
import { InventoryService } from '../../../../services/inventory.service';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = StockMovementSchema.safeParse(body);
    if (!validation.success) return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    const result = await InventoryService.adjustStock(validation.data, "system@cave.fr");
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    const status = error.message.includes("ALREADY_APPLIED") || error.message.includes("insuffisant") ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function GET() {
  try {
    const movements = await prisma.stockMovement.findMany({
      // On utilise createdAt au lieu de date
      orderBy: { createdAt: 'desc' } 
    });
    return NextResponse.json(movements, { status: 200 });
  } catch (error: any) {
    console.error("[GET_MOVEMENTS_ERROR]", error);
    return NextResponse.json({ error: "Erreur lors de la récupération des mouvements" }, { status: 500 });
  }
}