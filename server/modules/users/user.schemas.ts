import { z } from 'zod';
import { formatRoleLabel, normalizeRoleKey } from '@/lib/roles';

export const upsertUserSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  roleKey: z.string().trim().optional(),
  role: z.string().trim().optional(),
}).superRefine((data, context) => {
  const roleKey = normalizeRoleKey(data.roleKey) ?? normalizeRoleKey(data.role);

  if (!roleKey) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['roleKey'],
      message: 'Rôle utilisateur invalide.',
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

export type UpsertUserInput = z.infer<typeof upsertUserSchema>;
