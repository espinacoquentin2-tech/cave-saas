import { z } from 'zod';

const faReadingSchema = z.object({
  lotId: z.coerce.number().int().positive(),
  date: z.string().trim().min(1),
  density: z.coerce.number().min(980).max(1150).optional().nullable(),
  temperature: z.coerce.number().min(-5).max(45).optional().nullable(),
});

export const saveFaTourSchema = z.object({
  readings: z.array(faReadingSchema).min(1, 'Aucun relevé à sauvegarder'),
  idempotencyKey: z.string().trim().min(10),
});

export type SaveFaTourInput = z.infer<typeof saveFaTourSchema>;
