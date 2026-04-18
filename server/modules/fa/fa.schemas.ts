import { z } from 'zod';

const optionalNullableNumber = (schema: z.ZodTypeAny) =>
  z.preprocess((value) => (value === '' || value === undefined ? null : value), schema.nullable().optional());

const faReadingSchema = z.object({
  lotId: z.coerce.number().int().positive(),
  date: z.string().trim().min(1),
  density: optionalNullableNumber(z.coerce.number().min(980).max(1150)),
  temperature: optionalNullableNumber(z.coerce.number().min(-5).max(45)),
});

export const saveFaTourSchema = z.object({
  readings: z.array(faReadingSchema).min(1, 'Aucun relevé à sauvegarder'),
  idempotencyKey: z.string().trim().min(10),
});

export type SaveFaTourInput = z.infer<typeof saveFaTourSchema>;
