import { z } from 'zod';
import { FA_DENSITY_MAX, FA_DENSITY_MIN, FA_TEMPERATURE_MAX, FA_TEMPERATURE_MIN } from '@/validations/lots.schema';

const optionalNullableNumber = (schema: z.ZodTypeAny) =>
  z.preprocess((value) => (value === '' || value === undefined ? null : value), schema.nullable().optional());

const faReadingSchema = z.object({
  lotId: z.coerce.number().int().positive(),
  date: z.string().trim().min(1),
  density: optionalNullableNumber(z.coerce.number().min(FA_DENSITY_MIN).max(FA_DENSITY_MAX)),
  temperature: optionalNullableNumber(z.coerce.number().min(FA_TEMPERATURE_MIN).max(FA_TEMPERATURE_MAX)),
});

export const saveFaTourSchema = z.object({
  readings: z.array(faReadingSchema).min(1, 'Aucun relevé à sauvegarder'),
  idempotencyKey: z.string().trim().min(10),
});

export type SaveFaTourInput = z.infer<typeof saveFaTourSchema>;
