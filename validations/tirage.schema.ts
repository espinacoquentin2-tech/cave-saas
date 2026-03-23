import { z } from 'zod';

export const ExecuteMixtionSchema = z.object({
  baseTankId: z.string().min(1, "La cuve de base est requise"),
  levainTankId: z.string().min(1, "La cuve de levain est requise"),
  destTankId: z.string().min(1, "La cuve de destination est requise"),
  baseVolToDraw: z.number().positive("Le volume à tirer doit être supérieur à 0"),
  targetPressure: z.number().min(3).max(8, "La pression doit être entre 3 et 8 bars"),
  levainPct: z.number().min(0.5).max(10, "Le pourcentage de levain est invalide"),
  levainSugar: z.number().nonnegative(),
  sugarSource: z.enum(["LIQUEUR", "SUCRE"]),
  liqueurSugar: z.number().positive().optional(),
  tirageFormat: z.number().positive(),
  tirageBouchage: z.enum(["CAPSULE", "LIEGE"]),
  idempotencyKey: z.string().min(10, "Clé d'idempotence manquante")
});

export type ExecuteMixtionPayload = z.infer<typeof ExecuteMixtionSchema>;

export const TirageSchema = z.object({
  lotId: z.coerce.number().int().positive("L'ID du lot doit être un entier positif"),
  format: z.string().min(1, "Le format est requis"),
  count: z.coerce.number().int().positive("Le nombre de bouteilles doit être supérieur à 0"),
  volume: z.coerce.number().positive("Le volume doit être supérieur à 0"),
  zone: z.string().optional().nullable(),
  tirageDate: z.string().datetime({ message: "La date doit être au format valide (ISO 8601)" }),
  operator: z.string().email("L'opérateur doit être un email valide").optional(), // À terme, on le prendra du token de session
  note: z.string().optional().nullable(),
  isTranquille: z.boolean().default(false),
  idempotencyKey: z.string().min(10, "Clé d'idempotence invalide")
});

export type TiragePayload = z.infer<typeof TirageSchema>;