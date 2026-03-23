import { NextResponse } from 'next/server';
import { CreateProductSchema } from '../../../../validations/inventory.schema';
import { InventoryService } from '../../../../services/inventory.service';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = CreateProductSchema.safeParse(body);
    if (!validation.success) return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    const result = await InventoryService.createProduct(validation.data, "system@cave.fr");
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    const status = error.message.includes("ALREADY_APPLIED") ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' } // On trie par ordre alphabétique
    });
    return NextResponse.json(products, { status: 200 });
  } catch (error: any) {
    console.error("[GET_PRODUCTS_ERROR]", error);
    return NextResponse.json({ error: "Erreur lors de la récupération des produits" }, { status: 500 });
  }
}