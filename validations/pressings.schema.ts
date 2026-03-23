// validations/pressings.schema.ts
import { z } from 'zod';

export const LoadPressSchema = z.object({
  pressId: z.number().int().positive(),
  apportId: z.number().int().positive(),
  weightToLoad: z.number().positive("Le poids doit être supérieur à 0"),
  forceMix: z.boolean().default(false),
  idempotencyKey: z.string().min(10)
});

// Pour la modale de fractionnement (Cuvée, Taille, Rebêches)
export const FractionRowSchema = z.object({
  cuveId: z.number().int().positive(),
  vol: z.number().positive()
});

export const EcoulementSchema = z.object({
  pressId: z.number().int().positive(),
  cuveeDests: z.array(FractionRowSchema).optional().default([]),
  tailleDests: z.array(FractionRowSchema).optional().default([]),
  rebechesDests: z.array(FractionRowSchema).optional().default([]),
  operator: z.string(),
  idempotencyKey: z.string().min(10)
});