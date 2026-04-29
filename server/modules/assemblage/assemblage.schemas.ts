import { z } from 'zod';
import { ASSEMBLAGE_SOURCE_ROLES, ASSEMBLAGE_TYPES } from '@/lib/assemblage';

const legacySourceLotSchema = z.object({
  id: z.coerce.number().int().positive(),
  volumeUsed: z.coerce.number().positive(),
});

const legacySourceBottleSchema = z.object({
  id: z.coerce.number().int().positive(),
  countUsed: z.coerce.number().int().positive(),
  format: z.string().trim().min(1),
});

const lotComponentSchema = z.object({
  sourceType: z.literal('LOT'),
  lotId: z.coerce.number().int().positive(),
  volumeHl: z.coerce.number().positive(),
  originUnit: z.string().trim().min(1).default('hL'),
  originQuantity: z.coerce.number().positive().optional(),
  sourceRole: z.enum(ASSEMBLAGE_SOURCE_ROLES).optional(),
});

const bottleComponentSchema = z.object({
  sourceType: z.literal('BOTTLE_LOT'),
  bottleLotId: z.coerce.number().int().positive(),
  volumeHl: z.coerce.number().positive(),
  originUnit: z.string().trim().min(1),
  originQuantity: z.coerce.number().positive(),
  formatCode: z.string().trim().min(1).optional(),
  sourceRole: z.enum(ASSEMBLAGE_SOURCE_ROLES).optional(),
});

const adjuvantSchema = z.object({
  productId: z.coerce.number().int().positive(),
  dose: z.coerce.number().positive(),
  doseUnit: z.string().trim().min(1),
  treatedVolumeHl: z.coerce.number().positive(),
  quantityTotal: z.coerce.number().positive(),
  quantityUnit: z.string().trim().min(1),
});

export const createAssemblageSchema = z
  .object({
    code: z.string().trim().min(3),
    assemblageType: z.enum(ASSEMBLAGE_TYPES).optional(),
    millesime: z.union([z.coerce.number().int(), z.literal('SA')]).optional(),
    cepage: z.string().trim().min(1).optional(),
    volume: z.coerce.number().positive().optional(),
    components: z.array(z.union([lotComponentSchema, bottleComponentSchema])).default([]),
    sourceLots: z.array(legacySourceLotSchema).default([]),
    sourceBottles: z.array(legacySourceBottleSchema).default([]),
    containerDestinationId: z.coerce.number().int().positive().optional(),
    targetContainerId: z.coerce.number().int().positive().optional(),
    adjuvants: z.array(adjuvantSchema).default([]),
    compoDetails: z.string().trim().optional().nullable(),
    notes: z.string().trim().optional().nullable(),
    idempotencyKey: z.string().trim().min(10),
  })
  .superRefine((value, ctx) => {
    const hasSources =
      value.components.length > 0 || value.sourceLots.length > 0 || value.sourceBottles.length > 0;
    const destinationId = value.containerDestinationId ?? value.targetContainerId;

    if (!hasSources) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Au moins une source est requise pour créer un assemblage.',
        path: ['components'],
      });
    }

    if (!destinationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Une cuve de destination est requise.',
        path: ['containerDestinationId'],
      });
    }
  });

export type CreateAssemblageInput = z.infer<typeof createAssemblageSchema>;
