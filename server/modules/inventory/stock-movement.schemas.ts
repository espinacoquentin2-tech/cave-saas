import { z } from 'zod';

export const createStockMovementSchema = z.object({
  productId: z.coerce.number().int().positive(),
  type: z.enum(['IN', 'OUT']),
  quantity: z.coerce.number().positive(),
  note: z.string().trim().max(500).nullable().optional(),
  idempotencyKey: z.string().uuid(),
});

export const listStockMovementsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;
export type ListStockMovementsQuery = z.infer<typeof listStockMovementsQuerySchema>;
