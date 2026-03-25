import { z } from 'zod';

export const createLotSchema = z.object({
  code: z.string().trim().min(2),
  millesime: z.union([z.coerce.number().int().min(1900).max(3000), z.string().trim().min(4)]),
  cepage: z.string().trim().min(1),
  lieu: z.string().trim().optional().nullable(),
  volume: z.coerce.number().positive(),
  containerId: z.coerce.number().int().positive(),
  notes: z.string().trim().optional().nullable(),
  idempotencyKey: z.string().trim().min(10),
});

export const updateLotVolumeSchema = z.object({
  lotId: z.coerce.number().int().positive(),
  newVolume: z.coerce.number().min(0),
  note: z.string().trim().optional().nullable(),
  idempotencyKey: z.string().trim().min(10),
});

export type CreateLotInput = z.infer<typeof createLotSchema>;
export type UpdateLotVolumeInput = z.infer<typeof updateLotVolumeSchema>;
