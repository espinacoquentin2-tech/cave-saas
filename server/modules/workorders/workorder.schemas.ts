import { z } from 'zod';
import { ASSEMBLAGE_SOURCE_ROLES } from '@/lib/assemblage';

const sourceSchema = z.object({
  lotId: z.coerce.number().int().positive("L'ID du lot source est requis"),
  volume: z.coerce.number().positive('Le volume source doit être supérieur à 0'),
  role: z.enum(ASSEMBLAGE_SOURCE_ROLES).optional(),
  sourceRole: z.enum(ASSEMBLAGE_SOURCE_ROLES).optional(),
});

const intrantSourceSchema = z.object({
  kind: z.literal('INTRANT'),
  label: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1),
  productId: z.coerce.number().int().positive().optional().nullable(),
});

export const createWorkOrderSchema = z
  .object({
    recette: z.enum([
      'SOUTIRAGE',
      'ASSEMBLAGE',
      'TIRAGE',
      'LEVURAGE',
      'SULFITAGE',
      'CHAPTALISATION',
      'ACIDIFICATION',
      'COLLAGE',
      'FILTRATION',
      'STABILISATION TARTRIQUE',
      'OUILLAGE',
      'AJOUT AUTRE PRODUIT',
    ]),
    targetContainerId: z.coerce.number().int().positive().optional().nullable(),
    targetLotId: z.coerce.number().int().positive().optional().nullable(),
    details: z.string().trim().max(500).optional().nullable(),
    sources: z.array(z.union([sourceSchema, intrantSourceSchema])).default([]),
    idempotencyKey: z.string().trim().min(10),
  })
  .refine((data) => {
    const isTransfer = data.recette === 'SOUTIRAGE';
    const isAssemblage = data.recette === 'ASSEMBLAGE';
    const isTirage = data.recette === 'TIRAGE';
    const isIntrant = !isTransfer && !isAssemblage && !isTirage;
    const hasOnlyVolumeSources = data.sources.every((source) => !('kind' in source));

    if ((isTransfer || isAssemblage) && (!data.targetContainerId || data.sources.length === 0)) {
      return false;
    }

    if ((isTransfer || isAssemblage) && !hasOnlyVolumeSources) {
      return false;
    }

    if (isTirage && data.sources.length !== 1) {
      return false;
    }

    if (isTirage && !hasOnlyVolumeSources) {
      return false;
    }

    if (isIntrant && (!data.targetLotId || !data.details)) {
      return false;
    }

    if (isIntrant && data.sources.length > 0) {
      return data.sources.every((source) => 'kind' in source && source.kind === 'INTRANT');
    }

    return true;
  }, {
    message: 'Données incohérentes pour ce type d\'ordre de travail. Remplissez les champs obligatoires.',
    path: ['recette'],
  });

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
