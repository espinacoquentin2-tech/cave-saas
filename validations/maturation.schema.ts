// validations/maturation.schema.ts
import { z } from 'zod';

export const SaveMaturationSchema = z.object({
  id: z.number().optional(), // Présent uniquement si c'est une édition
  date: z.string().min(1, "La date est requise"),
  parcelle: z.string().min(1, "La parcelle est requise"),
  cepage: z.string().min(1, "Le cépage est requis"),
  sucre: z.number().nonnegative().optional(),
  ph: z.number().positive().optional(),
  at: z.number().nonnegative().optional(),
  malique: z.number().nonnegative().optional(),
  tartrique: z.number().nonnegative().optional(),
  maladie: z.enum(["Aucune", "Mildiou", "Oïdium", "Pourriture Grise"]).default("Aucune"),
  intensite: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().min(10, "Clé d'idempotence manquante")
});

export type SaveMaturationPayload = z.infer<typeof SaveMaturationSchema>;