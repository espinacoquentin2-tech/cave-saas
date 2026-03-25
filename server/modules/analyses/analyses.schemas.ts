import { z } from 'zod';

const analyseRowSchema = z.object({
  id: z.coerce.number().int().optional(),
  analysisDate: z.string().trim().min(1, 'La date est requise'),
  lotId: z.coerce.number().int().positive('Veuillez sélectionner un lot valide'),
  ph: z.coerce.number().positive().optional().nullable(),
  at: z.coerce.number().nonnegative().optional().nullable(),
  so2Free: z.coerce.number().nonnegative().optional().nullable(),
  so2Total: z.coerce.number().nonnegative().optional().nullable(),
  alcohol: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().trim().max(250).optional().nullable(),
  extraData: z.any().optional().nullable(),
});

export const saveAnalysesSchema = z.object({
  analyses: z.array(analyseRowSchema).min(1, 'Aucune analyse à sauvegarder'),
  idempotencyKey: z.string().trim().min(10),
});

export type SaveAnalysesInput = z.infer<typeof saveAnalysesSchema>;
