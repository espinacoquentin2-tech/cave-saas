import { z } from 'zod';

export const listBottleLotsQuerySchema = z.object({
  id: z.coerce.number().int().positive().optional(),
});

const optionalPositiveId = z.coerce.number().int().positive().optional().nullable();
const isoDateString = z.string().trim().min(10);

export const updateBottleStatusSchema = z.object({
  blId: z.coerce.number().int().positive(),
  status: z.enum(['EN_REMUAGE', 'SUR_POINTES', 'A_DEGORGER']),
  location: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable(),
  idempotencyKey: z.string().trim().min(10),
});

export const degorgerSchema = z.object({
  blId: z.coerce.number().int().positive(),
  count: z.coerce.number().int().positive(),
  degorgementDate: isoDateString,
  dosageGramsPerLiter: z.coerce.number().min(0),
  dosageLabel: z.string().trim().optional().nullable(),
  liqueurType: z.string().trim().min(1),
  liqueurProductId: optionalPositiveId,
  liqueurVolumeLiters: z.coerce.number().min(0).optional().nullable(),
  bouchonProductId: optionalPositiveId,
  museletProductId: optionalPositiveId,
  lossCount: z.coerce.number().int().min(0).default(0),
  note: z.string().trim().optional().nullable(),
  idempotencyKey: z.string().trim().min(10),
});

export const habillerSchema = z.object({
  blId: z.coerce.number().int().positive(),
  count: z.coerce.number().int().positive(),
  habillageDate: isoDateString,
  coiffeId: optionalPositiveId,
  etiquetteId: optionalPositiveId,
  contreEtiquetteId: optionalPositiveId,
  cartonId: optionalPositiveId,
  cartonSize: z.coerce.number().int().positive().default(6),
  note: z.string().trim().optional().nullable(),
  idempotencyKey: z.string().trim().min(10),
});

export const expedierSchema = z.object({
  blId: z.coerce.number().int().positive(),
  count: z.coerce.number().int().positive(),
  expeditionDate: isoDateString,
  clientName: z.string().trim().min(2, 'Le nom du client est requis'),
  destination: z.string().trim().min(1, 'La destination est obligatoire.'),
  note: z.string().trim().optional().nullable(),
  idempotencyKey: z.string().trim().min(10),
});

export const archiveBottleLotSchema = z.object({
  bottleLotId: z.coerce.number().int().positive(),
  reason: z.string().trim().min(3, "La raison d'archivage est obligatoire."),
  note: z.string().trim().optional().nullable(),
});

export const cancelBottleEventSchema = z.object({
  eventId: z.coerce.number().int().positive(),
  reason: z.string().trim().min(3, "La raison d'annulation est obligatoire."),
  note: z.string().trim().optional().nullable(),
});

export type ListBottleLotsQueryInput = z.infer<typeof listBottleLotsQuerySchema>;
export type UpdateBottleStatusInput = z.infer<typeof updateBottleStatusSchema>;
export type DegorgerInput = z.infer<typeof degorgerSchema>;
export type HabillerInput = z.infer<typeof habillerSchema>;
export type ExpedierInput = z.infer<typeof expedierSchema>;
export type ArchiveBottleLotInput = z.infer<typeof archiveBottleLotSchema>;
export type CancelBottleEventInput = z.infer<typeof cancelBottleEventSchema>;
