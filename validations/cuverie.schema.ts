import { z } from 'zod';

export const DecuvageSchema = z.object({
  sourceLotId: z.number().int().positive(),
  sourceContainerId: z.number().int().positive(),
  volGoutte: z.number().nonnegative(),
  cuveGoutteId: z.number().int().positive().optional().nullable(),
  volPresse: z.number().nonnegative(),
  cuvePresseId: z.number().int().positive().optional().nullable(),
  finalStatus: z.string().min(1),
  notes: z.string().optional().nullable(),
  operator: z.string(),
  idempotencyKey: z.string().min(10)
}).refine(data => data.volGoutte > 0 || data.volPresse > 0, "Aucun volume à décuver");

export const TransferSchema = z.object({
  lotId: z.number().int().positive(),
  fromId: z.number().int().positive(),
  destinations: z.array(z.object({
    toId: z.number().int().positive(),
    volume: z.number().positive()
  })).min(1),
  volume: z.number().positive(),
  remainderType: z.string().optional().nullable(),
  bourbesDestId: z.number().int().positive().optional().nullable(),
  date: z.string(),
  operator: z.string(),
  ph: z.number().optional().nullable(),
  at: z.number().optional().nullable(),
  tavp: z.number().optional().nullable(),
  idempotencyKey: z.string().min(10)
});