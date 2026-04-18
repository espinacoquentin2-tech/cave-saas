import { z } from 'zod';

const optionalNullableNumber = (schema: z.ZodTypeAny) =>
  z.preprocess((value) => (value === '' || value === undefined ? null : value), schema.nullable().optional());

const analyseRowSchema = z.object({
  id: z.coerce.number().int().optional(),
  analysisDate: z.string().trim().min(1, 'La date est requise'),
  lotId: z.coerce.number().int().positive('Veuillez sélectionner un lot valide'),
  ph: optionalNullableNumber(z.coerce.number().positive()),
  at: optionalNullableNumber(z.coerce.number().nonnegative()),
  so2Free: optionalNullableNumber(z.coerce.number().nonnegative()),
  so2Total: optionalNullableNumber(z.coerce.number().nonnegative()),
  alcohol: optionalNullableNumber(z.coerce.number().nonnegative()),
  notes: z.string().trim().max(250).optional().nullable(),
  extraData: z.any().optional().nullable(),
});

export const saveAnalysesSchema = z.object({
  analyses: z.array(analyseRowSchema).min(1, 'Aucune analyse à sauvegarder'),
  idempotencyKey: z.string().trim().min(10),
});

export type SaveAnalysesInput = z.infer<typeof saveAnalysesSchema>;
