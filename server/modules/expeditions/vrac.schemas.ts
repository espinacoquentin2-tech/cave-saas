import { z } from 'zod';

export const vracShipmentModes = ['CITERNE', 'VRAC', 'AUTRE'] as const;

export const createVracShipmentSchema = z.object({
  lotId: z.coerce.number().int().positive(),
  containerId: z.coerce.number().int().positive(),
  volumeHl: z.coerce.number().positive('Le volume a expedier doit etre superieur a 0.'),
  client: z.string().trim().min(1, 'Le client est obligatoire.'),
  destination: z.string().trim().min(1, 'La destination est obligatoire.'),
  mode: z.enum(vracShipmentModes),
  note: z.string().trim().optional().nullable(),
  idempotencyKey: z.string().trim().min(10).optional(),
});

export type CreateVracShipmentInput = z.infer<typeof createVracShipmentSchema>;
