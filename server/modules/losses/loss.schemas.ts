import { z } from 'zod';

export const createLossSchema = z.object({
  entityType: z.enum(['BOTTLE', 'BULK']),
  entityId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
  note: z.string().trim().min(1).max(500),
  idempotencyKey: z.string().uuid(),
});

export type CreateLossInput = z.infer<typeof createLossSchema>;
