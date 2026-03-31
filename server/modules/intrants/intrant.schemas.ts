import { z } from 'zod';

export const addIntrantSchema = z.object({
  lotId: z.coerce.number().int().positive(),
  intrant: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(10),
});

export type AddIntrantInput = z.infer<typeof addIntrantSchema>;
