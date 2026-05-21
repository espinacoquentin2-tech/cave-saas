import { z } from 'zod';

export const confirmDeliverySchema = z.object({
  type: z.enum(['BOTTLE', 'VRAC', 'DISTILLERIE']),
  id: z.coerce.number().int().positive(),
});

export type ConfirmDeliveryInput = z.infer<typeof confirmDeliverySchema>;
