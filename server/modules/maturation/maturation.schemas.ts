import { z } from 'zod';

const optionalNumber = (schema: z.ZodTypeAny) =>
  z.preprocess((value) => (value === '' || value === null ? undefined : value), schema.optional());

export const saveMaturationSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  date: z.string().trim().min(1, 'La date est requise'),
  parcelle: z.string().trim().min(1, 'La parcelle est requise'),
  cepage: z.string().trim().min(1, 'Le cépage est requis'),
  sucre: optionalNumber(z.coerce.number().nonnegative()),
  ph: optionalNumber(z.coerce.number().positive()),
  at: optionalNumber(z.coerce.number().nonnegative()),
  malique: optionalNumber(z.coerce.number().nonnegative()),
  tartrique: optionalNumber(z.coerce.number().nonnegative()),
  maladie: z.enum(['Aucune', 'Mildiou', 'Oïdium', 'Pourriture Grise']).default('Aucune'),
  intensite: optionalNumber(z.coerce.number().nonnegative()),
  notes: z.string().trim().optional(),
  idempotencyKey: z.string().trim().min(10),
});

export type SaveMaturationInput = z.infer<typeof saveMaturationSchema>;
