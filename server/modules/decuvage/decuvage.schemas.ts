import { z } from 'zod';

export const decuvageSchema = z.object({
  sourceLotId: z.coerce.number().int().positive(),
  sourceContainerId: z.coerce.number().int().positive(),
  volGoutte: z.coerce.number().nonnegative(),
  cuveGoutteId: z.coerce.number().int().positive().optional().nullable(),
  volPresse: z.coerce.number().nonnegative(),
  cuvePresseId: z.coerce.number().int().positive().optional().nullable(),
  finalStatus: z.string().trim().min(1),
  notes: z.string().trim().optional().nullable(),
  idempotencyKey: z.string().trim().min(10),
}).refine((data) => data.volGoutte > 0 || data.volPresse > 0, {
  message: 'Aucun volume à décuver.',
});

export type DecuvageInput = z.infer<typeof decuvageSchema>;
