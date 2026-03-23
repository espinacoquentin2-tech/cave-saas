// validations/cuverie.schema.ts
import { z } from 'zod';

export const DecuvageSchema = z.object({
  sourceLotId: z.coerce.number().int().positive("L'ID du lot source est requis"),
  sourceContainerId: z.coerce.number().int().positive("L'ID de la cuve source est requis"),
  volGoutte: z.coerce.number().nonnegative("Le volume Goutte ne peut pas être négatif"),
  cuveGoutteId: z.coerce.number().int().positive().optional().nullable(),
  volPresse: z.coerce.number().nonnegative("Le volume Presse ne peut pas être négatif"),
  cuvePresseId: z.coerce.number().int().positive().optional().nullable(),
  finalStatus: z.string().min(1, "Le statut final est requis"),
  notes: z.string().optional().nullable(),
  operator: z.string().email("L'opérateur doit être un email valide").optional(),
  idempotencyKey: z.string().min(10, "Clé d'idempotence invalide")
}).refine(data => data.volGoutte > 0 || data.volPresse > 0, {
  message: "Aucun volume à décuver"
});

export const TransferDestinationSchema = z.object({
  toId: z.coerce.number().int().positive("ID de cuve cible invalide"),
  volume: z.coerce.number().positive("Le volume de la cible doit être supérieur à 0")
});

export const TransferSchema = z.object({
  lotId: z.coerce.number().int().positive("L'ID du lot source est requis"),
  fromId: z.coerce.number().int().positive("L'ID de la cuve source est requis"),
  destinations: z.array(TransferDestinationSchema).min(1, "Au moins une destination est requise"),
  volume: z.coerce.number().positive("Le volume total doit être supérieur à 0"),
  remainderType: z.string().optional().nullable(),
  bourbesDestId: z.coerce.number().int().positive().optional().nullable(),
  date: z.string().datetime({ message: "La date doit être au format valide (ISO 8601)" }),
  operator: z.string().email("L'opérateur doit être un email valide").optional(),
  ph: z.coerce.number().positive().optional().nullable(),
  at: z.coerce.number().positive().optional().nullable(),
  tavp: z.coerce.number().positive().optional().nullable(),
  idempotencyKey: z.string().min(10, "Clé d'idempotence invalide")
});

export type TransferPayload = z.infer<typeof TransferSchema>;
export type DecuvagePayload = z.infer<typeof DecuvageSchema>;