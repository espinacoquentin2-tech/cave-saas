import { z } from 'zod';

export const AssemblageSchema = z.object({
  code: z.string().min(3),
  millesime: z.union([z.string(), z.number()]),
  cepage: z.string(),
  volume: z.number().positive(),
  sourceLots: z.array(z.object({ id: z.number(), volumeUsed: z.number() })).optional().default([]),
  sourceBottles: z.array(z.object({ id: z.number(), countUsed: z.number(), format: z.string() })).optional().default([]),
  targetContainerId: z.number().int().positive(),
  compoDetails: z.string().optional().nullable(),
  operator: z.string(),
  idempotencyKey: z.string().min(10)
});