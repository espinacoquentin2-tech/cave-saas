// validations/vendanges.schema.ts
import { z } from 'zod';

export const ProjectionsRequestSchema = z.object({
  globalTarget: z.number().min(5).max(18, "La cible globale doit être entre 5 et 18°"),
  customTargets: z.record(z.string(), z.number().min(5).max(18)).default({})
});

export type ProjectionsRequestPayload = z.infer<typeof ProjectionsRequestSchema>;

export const CreateApportSchema = z.object({
  date: z.string(),
  parcelle: z.string().min(1),
  cepage: z.string().min(1),
  poids: z.number().positive(),
  status: z.string().default("EN_ATTENTE"),
  idempotencyKey: z.string().min(10)
});

export const CreatePressoirSchema = z.object({
  nom: z.string().min(1),
  type: z.string(),
  marque: z.string(),
  capacite: z.number().positive(),
  idempotencyKey: z.string().min(10)
});

export const UpdatePressoirSchema = z.object({
  id: z.number().int().positive(),
  status: z.string(),
  loadKg: z.number().nullable().optional(),
  parcelle: z.string().nullable().optional(),
  cepage: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  idempotencyKey: z.string().min(10)
});