import { z } from 'zod';

const decimalPrecision = (value: number) => Number(value.toFixed(3));

export const tirageFormatSchema = z.enum(['37.5cl', '75cl', '150cl', '300cl']);

export const createTirageSchema = z
  .object({
    lotId: z.coerce.number().int().positive(),
    format: tirageFormatSchema,
    count: z.coerce.number().int().positive(),
    volume: z.coerce.number().positive().transform(decimalPrecision),
    zone: z.string().trim().max(120).nullable().optional(),
    tirageDate: z.string().datetime(),
    note: z.string().trim().max(500).nullable().optional(),
    isTranquille: z.coerce.boolean().default(false),
    idempotencyKey: z.string().uuid(),
  })
  .superRefine((payload, ctx) => {
    const formatVolumes = {
      '37.5cl': 0.00375,
      '75cl': 0.0075,
      '150cl': 0.015,
      '300cl': 0.03,
    } satisfies Record<z.infer<typeof tirageFormatSchema>, number>;

    const expectedVolume = decimalPrecision(payload.count * formatVolumes[payload.format]);
    if (Math.abs(expectedVolume - payload.volume) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['volume'],
        message: `Le volume (${payload.volume} hL) est incohérent avec ${payload.count} bouteilles au format ${payload.format} (${expectedVolume} hL attendus).`,
      });
    }
  });

export type CreateTirageInput = z.infer<typeof createTirageSchema>;
