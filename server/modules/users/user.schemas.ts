import { z } from 'zod';

export const upsertUserSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  role: z.enum(['Admin', 'Chef de cave', 'Caviste', 'Lecture seule']),
});

export type UpsertUserInput = z.infer<typeof upsertUserSchema>;
