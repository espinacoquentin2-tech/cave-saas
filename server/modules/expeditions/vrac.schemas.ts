import { z } from 'zod';

export const vracShipmentModes = ['CITERNE', 'VRAC', 'AUTRE'] as const;

const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional()
  .nullable();

const vracShipmentLineSchema = z.object({
  lotId: z.coerce.number().int().positive(),
  volumeHl: z.coerce.number().positive('Le volume a expedier doit etre superieur a 0.'),
  compartmentLabel: optionalTrimmedString,
  mode: z.enum(vracShipmentModes).default('VRAC'),
  note: optionalTrimmedString,
});

const newVracShipmentSchema = z.object({
  client: z.string().trim().min(1, 'Le client est obligatoire.'),
  destination: optionalTrimmedString,
  transporter: optionalTrimmedString,
  truckPlate: optionalTrimmedString,
  transportReference: optionalTrimmedString,
  plannedAt: optionalTrimmedString.refine(
    (value) => !value || !Number.isNaN(new Date(value).getTime()),
    'La date prevue est invalide.',
  ),
  logisticsNote: optionalTrimmedString,
  lines: z.array(vracShipmentLineSchema).min(1, 'Au moins une ligne est obligatoire.'),
  idempotencyKey: z.string().trim().min(10).optional(),
});

const legacyVracShipmentSchema = z.object({
  lotId: z.coerce.number().int().positive(),
  containerId: z.coerce.number().int().positive().optional(),
  volumeHl: z.coerce.number().positive('Le volume a expedier doit etre superieur a 0.'),
  client: z.string().trim().min(1, 'Le client est obligatoire.'),
  destination: optionalTrimmedString,
  mode: z.enum(vracShipmentModes),
  note: optionalTrimmedString,
  idempotencyKey: z.string().trim().min(10).optional(),
});

export const createVracShipmentSchema = z.union([newVracShipmentSchema, legacyVracShipmentSchema]).transform((payload) => {
  if ('lines' in payload) {
    return payload;
  }

  return {
    client: payload.client,
    destination: payload.destination,
    transporter: undefined,
    truckPlate: undefined,
    transportReference: undefined,
    plannedAt: undefined,
    logisticsNote: payload.note,
    lines: [
      {
        lotId: payload.lotId,
        volumeHl: payload.volumeHl,
        compartmentLabel: undefined,
        mode: payload.mode,
        note: payload.note,
      },
    ],
    idempotencyKey: payload.idempotencyKey,
  };
});

export type CreateVracShipmentInput = z.infer<typeof createVracShipmentSchema>;
