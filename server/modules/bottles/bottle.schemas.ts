import { z } from 'zod';

export const updateBottleStatusSchema = z.object({
  blId: z.coerce.number().int().positive(),
  status: z.enum(['EN_REMUAGE', 'SUR_POINTES', 'A_DEGORGER']),
  location: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable(),
  idempotencyKey: z.string().trim().min(10),
});

export const degorgerSchema = z.object({
  blId: z.coerce.number().int().positive(),
  count: z.coerce.number().int().positive(),
  dosage: z.string().trim().min(1),
  suffix: z.string().trim(),
  note: z.string().trim().optional().nullable(),
  idempotencyKey: z.string().trim().min(10),
});

export const habillerSchema = z.object({
  blId: z.coerce.number().int().positive(),
  count: z.coerce.number().int().positive(),
  coiffeId: z.coerce.number().int().positive().optional().nullable(),
  etiquetteId: z.coerce.number().int().positive().optional().nullable(),
  cartonId: z.coerce.number().int().positive().optional().nullable(),
  cartonSize: z.coerce.number().int().positive().default(6),
  idempotencyKey: z.string().trim().min(10),
});

export const expedierSchema = z.object({
  blId: z.coerce.number().int().positive(),
  count: z.coerce.number().int().positive(),
  clientName: z.string().trim().min(2, 'Le nom du client est requis'),
  idempotencyKey: z.string().trim().min(10),
});

export type UpdateBottleStatusInput = z.infer<typeof updateBottleStatusSchema>;
export type DegorgerInput = z.infer<typeof degorgerSchema>;
export type HabillerInput = z.infer<typeof habillerSchema>;
export type ExpedierInput = z.infer<typeof expedierSchema>;
