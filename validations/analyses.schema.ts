// validations/analyses.schema.ts
import { z } from 'zod';

export const AnalyseRowSchema = z.object({
  id: z.number().int().optional(),
  analysisDate: z.string().min(1, "La date est requise"),
  lotId: z.number().int().positive("Veuillez sélectionner un lot valide"),
  ph: z.number().positive("Le pH doit être un nombre positif").optional().nullable(),
  at: z.number().nonnegative().optional().nullable(),
  so2Free: z.number().nonnegative().optional().nullable(),
  so2Total: z.number().nonnegative().optional().nullable(),
  alcohol: z.number().nonnegative().optional().nullable(),
  notes: z.string().max(250).optional().nullable(),
  // 👈 CORRECTION ICI : z.any() au lieu de z.record()
  extraData: z.any().optional().nullable() 
});

export const SaveAnalysesSchema = z.object({
  analyses: z.array(AnalyseRowSchema).min(1, "Aucune analyse à sauvegarder"),
  idempotencyKey: z.string().min(10, "Clé d'idempotence manquante")
});

export type SaveAnalysesPayload = z.infer<typeof SaveAnalysesSchema>;