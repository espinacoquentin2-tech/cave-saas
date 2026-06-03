// validations/lots.schema.ts
import { z } from 'zod';

export const FA_DENSITY_MIN = 980;
export const FA_DENSITY_MAX = 1150;
export const FA_TEMPERATURE_MIN = -5;
export const FA_TEMPERATURE_MAX = 45;

export const AddIntrantSchema = z.object({
  lotId: z.number().int().positive(),
  intrant: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  productId: z.number().int().positive().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  idempotencyKey: z.string().min(10)
});

export const FaReadingRowSchema = z.object({
  lotId: z.number().int().positive(),
  date: z.string().min(1),
  density: z.number().min(FA_DENSITY_MIN).max(FA_DENSITY_MAX).optional().nullable(),
  temperature: z.number().min(FA_TEMPERATURE_MIN).max(FA_TEMPERATURE_MAX).optional().nullable(),
});

export const SaveFaTourSchema = z.object({
  readings: z.array(FaReadingRowSchema).min(1, "Aucun relevé à sauvegarder"),
  idempotencyKey: z.string().min(10)
});

export const CreateLotSchema = z.object({
  code: z.string().min(2),
  millesime: z.union([z.string(), z.number()]),
  cepage: z.string(),
  lieu: z.string().optional().nullable(),
  volume: z.number().positive(),
  containerId: z.number().int().positive(),
  notes: z.string().optional().nullable(),
  operator: z.string().optional(),
  idempotencyKey: z.string().min(10)
});

export const UpdateLotStatusSchema = z.object({
  lotId: z.number().int().positive(),
  newStatus: z.string().min(2),
  note: z.string().optional().nullable(),
  idempotencyKey: z.string().min(10)
});

export const UpdateLotVolumeSchema = z.object({
  lotId: z.number().int().positive(),
  newVolume: z.number().min(0),
  note: z.string().optional().nullable(),
  idempotencyKey: z.string().min(10)
});
