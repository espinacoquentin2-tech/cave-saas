// validations/degustation.schema.ts
import { z } from 'zod';

export const SaveDegustationSchema = z.object({
  date: z.string().min(1, "La date est requise"),
  phase: z.enum(["BAIES", "FERMENTATION", "VINS_CLAIRS", "DOSAGE", "CHAMPAGNE"]),
  parcelle: z.string().optional().nullable(),
  lotId: z.string().optional().nullable(),
  bottleLotId: z.string().optional().nullable(),
  robe: z.string().optional().nullable(),
  nez: z.string().optional().nullable(),   // Chaîne de tags séparés par des virgules
  bouche: z.string().optional().nullable(), // Chaîne de tags séparés par des virgules
  noteGlobale: z.number().min(0).max(20).optional().nullable(),
  sucreTest: z.number().nonnegative().optional().nullable(),
  notes: z.string().max(250, "Le commentaire est limité à 250 caractères").optional().nullable(),
  idempotencyKey: z.string().min(10, "Clé d'idempotence manquante")
}).refine(data => {
  // Vérification croisée : La cible doit correspondre à la phase
  if (data.phase === "BAIES" && !data.parcelle) return false;
  if (["FERMENTATION", "VINS_CLAIRS", "DOSAGE", "CHAMPAGNE"].includes(data.phase) && !data.lotId) return false;
  return true;
}, {
  message: "Veuillez sélectionner l'élément ciblé (Parcelle/Cépage ou Lot) correspondant à la phase.",
  path: ["phase"] // L'erreur remontera sur le champ phase
});

export type SaveDegustationPayload = z.infer<typeof SaveDegustationSchema>;
