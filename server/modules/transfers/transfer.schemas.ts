import { z } from 'zod';

const decimalPrecision = (value: number) => Number(value.toFixed(3));

export const transferDestinationSchema = z.object({
  toId: z.coerce.number().int().positive(),
  volume: z.coerce.number().positive().transform(decimalPrecision),
});

export const createTransferSchema = z
  .object({
    lotId: z.coerce.number().int().positive(),
    fromId: z.coerce.number().int().positive(),
    destinations: z.array(transferDestinationSchema).min(1),
    volume: z.coerce.number().positive().transform(decimalPrecision),
    remainderType: z.enum(['BOURBES', 'LIES']).nullable().optional(),
    bourbesDestId: z.coerce.number().int().positive().nullable().optional(),
    date: z.string().datetime(),
    idempotencyKey: z.string().uuid(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((payload, ctx) => {
    const totalDestinations = decimalPrecision(
      payload.destinations.reduce((sum, destination) => sum + destination.volume, 0),
    );

    if (totalDestinations !== payload.volume) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destinations'],
        message: 'La somme des volumes de destination doit être égale au volume transféré.',
      });
    }

    if (payload.destinations.some((destination) => destination.toId === payload.fromId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destinations'],
        message: 'Une destination ne peut pas être identique à la cuve source.',
      });
    }

    if (payload.remainderType && !payload.bourbesDestId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bourbesDestId'],
        message: 'La cuve de destination des bourbes/lies est obligatoire.',
      });
    }

    if (payload.bourbesDestId && payload.bourbesDestId === payload.fromId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bourbesDestId'],
        message: 'La cuve de reliquat doit être distincte de la cuve source.',
      });
    }
  });

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
