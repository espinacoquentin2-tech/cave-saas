import { z } from 'zod';

export const addIntrantSchema = z.object({
  lotId: z.coerce.number().int().positive(),
  intrant: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1),
  productId: z.coerce.number().int().positive().optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  idempotencyKey: z.string().trim().min(10),
});

export type AddIntrantInput = z.infer<typeof addIntrantSchema>;
