import { z } from 'zod';

export const ExecuteLossSchema = z.object({
  // CORRECTION : Zod attend 'message' (ou un objet errorMap) pour les enums
  entityType: z.enum(["BOTTLE", "BULK"], { 
    message: "Le type d'entité est invalide ou manquant" 
  }),
  entityId: z.string().min(1, "L'ID du lot est requis"),
  amount: z.number().positive("Le montant doit être supérieur à 0"),
  note: z.string().min(1, "Un motif est obligatoire pour les douanes"),
  idempotencyKey: z.string().min(10, "Clé d'idempotence manquante")
});

export type ExecuteLossPayload = z.infer<typeof ExecuteLossSchema>;