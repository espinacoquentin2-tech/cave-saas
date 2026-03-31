import { z } from 'zod';

export const createInventoryProductSchema = z.object({
  name: z.string().trim().min(2, 'Le nom du produit est requis'),
  category: z.string().trim().min(1, 'La catégorie est requise'),
  subCategory: z.string().trim().min(1, 'La sous-catégorie est requise'),
  unit: z.string().trim().min(1, 'L\'unité est requise'),
  minStock: z.coerce.number().nonnegative().default(0),
  currentStock: z.coerce.number().nonnegative().default(0),
  idempotencyKey: z.string().trim().min(10),
});

export type CreateInventoryProductInput = z.infer<typeof createInventoryProductSchema>;
