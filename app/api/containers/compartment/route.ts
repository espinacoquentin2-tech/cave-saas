// app/api/containers/compartment/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { originalContainerId, newCapacity } = await req.json();

    const result = await prisma.$transaction(async (tx) => {
      // On récupère la Citerne Mère et ses enfants actuels
      const parentContainer = await tx.container.findUnique({ 
        where: { id: parseInt(originalContainerId) },
        include: { children: true } 
      });
      
      if (!parentContainer) throw new Error("Citerne introuvable");

      // On calcule le numéro du prochain compartiment
      const newCompNumber = parentContainer.children.length + 2;
      const baseName = parentContainer.displayName.replace(/ - Comp \d+$/, '');

      // On crée l'enfant, relié à sa mère
      const newComp = await tx.container.create({
        data: {
          code: `COMP-${Date.now()}-${Math.floor(Math.random()*100)}`,
          displayName: `${baseName} - Comp ${newCompNumber}`,
          type: "COMPARTIMENT", // <-- On le marque bien comme compartiment
          capacityValue: newCapacity,
          status: "VIDE",
          parentId: parentContainer.id // <-- LA LIGNE MAGIQUE QUI MANQUAIT !
        }
      });

      return newComp;
    });

    return NextResponse.json({ success: true, container: result });
  } catch (error: any) {
    console.error("Erreur création compartiment:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}