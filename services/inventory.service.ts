// services/inventory.service.ts
import { PrismaClient } from '@prisma/client';
import { CreateProductPayload, StockMovementPayload } from '../validations/inventory.schema';

const prisma = new PrismaClient();

export class InventoryService {
  
  static async createProduct(data: CreateProductPayload, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Produit déjà créé.");

      const product = await tx.product.create({
        data: {
          name: data.name,
          category: data.category,
          subCategory: data.subCategory,
          unit: data.unit,
          minStock: data.minStock,
          currentStock: data.currentStock
        }
      });

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "CREATE_PRODUCT", userId: userEmail } });
      
      // Si on initialise avec du stock, on crée un mouvement initial
      if (data.currentStock > 0) {
        await tx.stockMovement.create({
          data: { productId: product.id, type: "IN", quantity: data.currentStock, note: "Stock initial", operator: userEmail }
        });
      }

      return { status: "SUCCESS", product };
    });
  }

  static async adjustStock(data: StockMovementPayload, userEmail: string) {
    return await prisma.$transaction(async (tx) => {
      const existingTx = await tx.idempotencyRecord.findUnique({ where: { key: data.idempotencyKey } });
      if (existingTx) throw new Error("ALREADY_APPLIED: Mouvement déjà enregistré.");

      const product = await tx.product.findUnique({ where: { id: data.productId } });
      if (!product) throw new Error("Produit introuvable.");

      let newStock = Number(product.currentStock);
      
      if (data.type === "IN") {
        newStock += data.quantity;
      } else {
        if (Number(product.currentStock) < data.quantity) {
          throw new Error(`Stock insuffisant. Dispo: ${product.currentStock} ${product.unit}, Requis: ${data.quantity}`);
        }
        newStock -= data.quantity;
      }

      await tx.product.update({
        where: { id: product.id },
        data: { currentStock: newStock }
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId: product.id,
          type: data.type,
          quantity: data.quantity,
          note: data.note,
          operator: userEmail
        }
      });

      await tx.idempotencyRecord.create({ data: { key: data.idempotencyKey, action: "STOCK_MOVEMENT", userId: userEmail } });

      return { status: "SUCCESS", newStock, movement };
    });
  }
}