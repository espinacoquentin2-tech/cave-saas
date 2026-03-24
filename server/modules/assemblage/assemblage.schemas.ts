import { z } from 'zod';

const sourceLotSchema = z.object({
  id: z.coerce.number().int().positive(),
  volumeUsed: z.coerce.number().positive(),
});

const sourceBottleSchema = z.object({
  id: z.coerce.number().int().positive(),
  countUsed: z.coerce.number().int().positive(),
  format: z.string().trim().min(1),
});

export const createAssemblageSchema = z.object({
  code: z.string().trim().min(3),
  millesime: z.union([z.coerce.number().int(), z.literal('SA')]),
  cepage: z.string().trim().min(1),
  volume: z.coerce.number().positive(),
  sourceLots: z.array(sourceLotSchema).default([]),
  sourceBottles: z.array(sourceBottleSchema).default([]),
  targetContainerId: z.coerce.number().int().positive(),
  compoDetails: z.string().trim().optional().nullable(),
  idempotencyKey: z.string().trim().min(10),
});

export type CreateAssemblageInput = z.infer<typeof createAssemblageSchema>;
