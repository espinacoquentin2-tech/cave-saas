import { z } from 'zod';

const sourceSchema = z.object({
  lotId: z.coerce.number().int().positive("L'ID du lot source est requis"),
  volume: z.coerce.number().positive('Le volume source doit être supérieur à 0'),
});

export const createWorkOrderSchema = z
  .object({
    recette: z.enum([
      'SOUTIRAGE',
      'ASSEMBLAGE',
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
    sources: z.array(sourceSchema).min(1, 'Au moins un lot source est requis pour un mouvement'),
    idempotencyKey: z.string().trim().min(10),
  })
  .refine((data) => {
    const isTransfer = data.recette === 'SOUTIRAGE';
    const isAssemblage = data.recette === 'ASSEMBLAGE';
    const isIntrant = !isTransfer && !isAssemblage;

    if ((isTransfer || isAssemblage) && !data.targetContainerId) {
      return false;
    }

    if (isIntrant && (!data.targetLotId || !data.details)) {
      return false;
    }

    return true;
  }, {
    message: 'Données incohérentes pour ce type d\'ordre de travail. Remplissez les champs obligatoires.',
    path: ['recette'],
  });

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
