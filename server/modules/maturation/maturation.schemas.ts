import { z } from 'zod';

export const saveMaturationSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  date: z.string().trim().min(1, 'La date est requise'),
  parcelle: z.string().trim().min(1, 'La parcelle est requise'),
  cepage: z.string().trim().min(1, 'Le cépage est requis'),
  sucre: z.coerce.number().nonnegative().optional(),
  ph: z.coerce.number().positive().optional(),
  at: z.coerce.number().nonnegative().optional(),
  malique: z.coerce.number().nonnegative().optional(),
  tartrique: z.coerce.number().nonnegative().optional(),
  maladie: z.enum(['Aucune', 'Mildiou', 'Oïdium', 'Pourriture Grise']).default('Aucune'),
  intensite: z.coerce.number().nonnegative().optional(),
  notes: z.string().trim().optional(),
  idempotencyKey: z.string().trim().min(10),
});

export type SaveMaturationInput = z.infer<typeof saveMaturationSchema>;
