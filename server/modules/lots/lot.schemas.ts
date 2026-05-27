import { z } from 'zod';

export const createLotSchema = z.object({
  code: z.string().trim().min(2),
  millesime: z.union([z.coerce.number().int().min(1900).max(3000), z.string().trim().min(4)]),
  cepage: z.string().trim().min(1),
  lieu: z.string().trim().optional().nullable(),
  volume: z.coerce.number().positive(),
  containerId: z.coerce.number().int().positive(),
  status: z
    .enum([
      'ACTIF',
      'MOUT_NON_DEBOURBE',
      'MOUT_DEBOURBE',
      'FERMENTATION_ALCOOLIQUE',
      'FERMENTATION_MALOLACTIQUE',
      'FA_ET_FML',
      'VIN_DE_BASE',
      'RESERVE',
      'ASSEMBLAGE',
      'ASSEMBLE',
      'VIN_ROUGE',
      'BOURBES',
      'LIES',
      'REBECHES',
    ])
    .default('ACTIF'),
  qualiteLot: z.string().trim().optional().nullable(),
  originType: z.enum(['DOMAINE', 'NEGOCE', 'ACHAT_EXTERNE']).optional().nullable(),
  originLabel: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  idempotencyKey: z.string().trim().min(10),
});

export const updateLotVolumeSchema = z.object({
  lotId: z.coerce.number().int().positive(),
  newVolume: z.coerce.number().min(0),
  note: z.string().trim().optional().nullable(),
  idempotencyKey: z.string().trim().min(10),
});

export type CreateLotInput = z.infer<typeof createLotSchema>;
export type UpdateLotVolumeInput = z.infer<typeof updateLotVolumeSchema>;
