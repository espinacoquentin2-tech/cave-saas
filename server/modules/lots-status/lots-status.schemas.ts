import { z } from 'zod';

export const updateLotStatusSchema = z.object({
  lotId: z.coerce.number().int().positive(),
  newStatus: z.string().trim().min(2),
  note: z.string().trim().optional().nullable(),
  idempotencyKey: z.string().trim().min(10),
});

export type UpdateLotStatusInput = z.infer<typeof updateLotStatusSchema>;
