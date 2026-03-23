// validations/bottles.schema.ts
import { z } from 'zod';

export const UpdateBottleStatusSchema = z.object({
  blId: z.number().int().positive(),
  status: z.enum(["EN_REMUAGE", "SUR_POINTES", "A_DEGORGER"]),
  location: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  idempotencyKey: z.string().min(10)
});

export const DegorgerSchema = z.object({
  blId: z.number().int().positive(),
  count: z.number().int().positive(),
  dosage: z.string().min(1),
  suffix: z.string(),
  note: z.string().optional().nullable(),
  idempotencyKey: z.string().min(10)
});

export const HabillerSchema = z.object({
  blId: z.number().int().positive(),
  count: z.number().int().positive(),
  coiffeId: z.number().int().optional().nullable(),
  etiquetteId: z.number().int().optional().nullable(),
  cartonId: z.number().int().optional().nullable(),
  cartonSize: z.number().int().positive().default(6),
  idempotencyKey: z.string().min(10)
});

export const ExpedierSchema = z.object({
  blId: z.number().int().positive(),
  count: z.number().int().positive(),
  clientName: z.string().min(2, "Le nom du client est requis"),
  idempotencyKey: z.string().min(10)
});