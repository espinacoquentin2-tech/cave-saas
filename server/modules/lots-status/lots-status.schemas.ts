import { z } from 'zod';
import { LOT_STATUS_VALUES } from '@/lib/lot-status-transitions';

export const updateLotStatusSchema = z.object({
  lotId: z.coerce.number().int().positive(),
  newStatus: z.enum(LOT_STATUS_VALUES),
  note: z.string().trim().optional().nullable(),
  idempotencyKey: z.string().trim().min(10),
});

export type UpdateLotStatusInput = z.infer<typeof updateLotStatusSchema>;
