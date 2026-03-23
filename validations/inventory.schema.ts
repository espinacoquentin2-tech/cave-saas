// validations/inventory.schema.ts
import { z } from 'zod';

export const CreateProductSchema = z.object({
  name: z.string().min(2, "Le nom du produit est requis"),
  category: z.string().min(1, "La catégorie est requise"),
  subCategory: z.string().min(1, "La sous-catégorie est requise"),
  unit: z.string().min(1, "L'unité est requise"),
  minStock: z.number().nonnegative().default(0),
  currentStock: z.number().nonnegative().default(0),
  idempotencyKey: z.string().min(10)
});

export const StockMovementSchema = z.object({
  productId: z.number().int().positive("Produit invalide"),
  type: z.enum(["IN", "OUT"]),
  quantity: z.number().positive("La quantité doit être supérieure à 0"),
  note: z.string().optional().nullable(),
  idempotencyKey: z.string().min(10)
});

export type CreateProductPayload = z.infer<typeof CreateProductSchema>;
export type StockMovementPayload = z.infer<typeof StockMovementSchema>;