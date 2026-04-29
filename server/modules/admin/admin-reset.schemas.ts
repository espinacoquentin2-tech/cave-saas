import { z } from 'zod';

export const adminResetDatabaseSchema = z.object({
  confirmation: z.literal('RESET DATABASE'),
  mode: z.literal('business-data'),
  reseed: z.boolean(),
});

export type AdminResetDatabaseInput = z.infer<typeof adminResetDatabaseSchema>;
