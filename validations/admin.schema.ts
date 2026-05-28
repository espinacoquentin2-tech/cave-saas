// validations/admin.schema.ts
import { z } from 'zod';
import { formatRoleLabel, normalizeRoleKey } from '@/lib/roles';

// Validation pour les Ordres de Travail
export const CreateWorkOrderSchema = z.object({
  recette: z.enum([
    "SOUTIRAGE", "ASSEMBLAGE", "TIRAGE", "LEVURAGE", "SULFITAGE",
    "CHAPTALISATION", "ACIDIFICATION", "COLLAGE", "FILTRATION", 
    "STABILISATION TARTRIQUE", "OUILLAGE", "AJOUT AUTRE PRODUIT"
  ]),
  targetContainerId: z.number().int().optional().nullable(),
  targetLotId: z.number().int().optional().nullable(),
  details: z.string().max(500).optional().nullable(),
  sources: z.array(z.object({
    lotId: z.number().int().positive("L'ID du lot source est requis"),
    volume: z.number().positive("Le volume source doit être supérieur à 0")
  })).default([]),
  idempotencyKey: z.string().min(10, "Clé d'idempotence manquante")
}).refine(data => {
  // Validation croisée selon le type de recette
  const isTransfer = data.recette === "SOUTIRAGE";
  const isAssemblage = data.recette === "ASSEMBLAGE";
  const isTirage = data.recette === "TIRAGE";
  const isIntrant = !isTransfer && !isAssemblage && !isTirage;

  if ((isTransfer || isAssemblage) && (!data.targetContainerId || data.sources.length === 0)) return false;
  if (isTirage && data.sources.length !== 1) return false;
  if (isIntrant && (!data.targetLotId || !data.details)) return false;
  return true;
}, {
  message: "Données incohérentes pour ce type d'ordre de travail. Remplissez les champs obligatoires.",
  path: ["recette"]
});

export type CreateWorkOrderPayload = z.infer<typeof CreateWorkOrderSchema>;

// Validation pour la Gestion des Utilisateurs
export const UserSchema = z.object({
  id: z.number().int().optional(), // Présent pour l'édition
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Format d'email invalide"),
  roleKey: z.string().trim().optional(),
  role: z.string().trim().optional()
}).superRefine((data, context) => {
  const roleKey = normalizeRoleKey(data.roleKey) ?? normalizeRoleKey(data.role);

  if (!roleKey) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["roleKey"],
      message: "Rôle utilisateur invalide.",
    });
  }
}).transform((data) => {
  const roleKey = normalizeRoleKey(data.roleKey) ?? normalizeRoleKey(data.role);

  return {
    ...data,
    roleKey: roleKey!,
    role: formatRoleLabel(roleKey),
  };
});

export type UserPayload = z.infer<typeof UserSchema>;
