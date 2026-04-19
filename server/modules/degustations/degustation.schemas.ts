import { z } from 'zod';

const optionalNullableNumber = (schema: z.ZodTypeAny) =>
  z.preprocess((value) => (value === '' || value === undefined ? null : value), schema.nullable().optional());

export const saveDegustationSchema = z
  .object({
    date: z.string().trim().min(1, 'La date est requise'),
    phase: z.enum(['BAIES', 'FERMENTATION', 'VINS_CLAIRS', 'DOSAGE', 'CHAMPAGNE']),
    parcelle: z.string().trim().optional().nullable(),
    lotId: z.string().trim().optional().nullable(),
    bottleLotId: z.string().trim().optional().nullable(),
    robe: z.string().trim().optional().nullable(),
    nez: z.string().trim().optional().nullable(),
    bouche: z.string().trim().optional().nullable(),
    noteGlobale: optionalNullableNumber(z.coerce.number().min(0).max(20)),
    sucreTest: optionalNullableNumber(z.coerce.number().nonnegative()),
    notes: z.string().trim().max(250).optional().nullable(),
    idempotencyKey: z.string().trim().min(10),
  })
  .refine((data) => {
    if (data.phase === 'BAIES' && !data.parcelle) return false;
    if (['FERMENTATION', 'VINS_CLAIRS', 'DOSAGE', 'CHAMPAGNE'].includes(data.phase) && !data.lotId) return false;
    return true;
  }, {
    message: 'Veuillez sélectionner l\'élément ciblé (Parcelle/Cépage ou Lot) correspondant à la phase.',
    path: ['phase'],
  });

export type SaveDegustationInput = z.infer<typeof saveDegustationSchema>;
