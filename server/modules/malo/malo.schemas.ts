import { z } from "zod";
const id = z.number().int().positive(),
  positive = z.number().finite().positive(),
  quantity = z.number().finite().nonnegative(),
  key = z.string().uuid(),
  date = z.string().datetime({ offset: true });
export const snapshotSchema = z
  .object({
    lotId: id,
    volumeHl: quantity,
    status: z.string().min(1),
    compositionEventId: id.nullable(),
    lastMutationEventId: id.nullable(),
  })
  .strict();
export const protocolSchema = z
  .object({
    schemaVersion: z.literal(1),
    profile: z.enum(["PROGRESSIVE", "CO_INOCULATION", "CUSTOM"]),
    label: z.string().min(1).max(100),
    reference: z.string().max(1000),
    notes: z.string().max(10000),
    mrTemperatureMin: z.number().finite().nullable(),
    mrTemperatureMax: z.number().finite().nullable(),
    pcmFaTemperature: z.number().finite().nullable(),
    pcmFmlTemperature: z.number().finite().nullable(),
    mrMalicThreshold: positive.nullable(),
    mrDays: z.number().int().positive().nullable(),
    doublingDays: z.number().int().positive().nullable(),
    pcmFirstControlDays: z.number().int().positive().nullable(),
    pcmControlIntervalDays: z.number().int().positive().nullable(),
    recipientFirstControlDays: z.number().int().positive().nullable(),
    preparedPcmPct: positive.nullable(),
  })
  .strict();
const planned = z
  .array(z.object({ lotId: id, dosePct: positive }).strict())
  .max(200)
  .refine(
    (a) => new Set(a.map((x) => x.lotId)).size === a.length,
    "Destination en double",
  );
export const createDossierSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    year: z.number().int().min(1900).max(2200),
    plannedVolumeHl: positive,
    dosePct: positive.default(4),
    profile: z.enum(["PROGRESSIVE", "CO_INOCULATION", "CUSTOM"]),
    protocol: protocolSchema.optional(),
    notes: z.string().max(10000).optional(),
    plannedDestinations: planned.default([]),
    idempotencyKey: key,
  })
  .strict();
export const updateDossierSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    notes: z.string().max(10000).optional(),
    plannedVolumeHl: positive.optional(),
    dosePct: positive.optional(),
    plannedDestinations: planned.optional(),
    idempotencyKey: key,
  })
  .strict();
const product = z
  .object({
    productId: id,
    role: z.enum(["BACTERIES", "ACTIVATEUR", "LSA", "AUTRE"]),
    label: z.string().max(200).optional(),
    quantity: positive,
    unit: z.enum(["g", "kg", "L", "hL"]),
    addedVolumeHl: quantity.default(0),
  })
  .strict()
  .refine(
    (p) => !["g", "kg"].includes(p.unit) || p.addedVolumeHl === 0,
    "Un solide n’ajoute pas de volume",
  )
  .refine(
    (p) => !["L", "hL"].includes(p.unit) || p.addedVolumeHl > 0,
    "Renseignez le volume réel de l’intrant liquide",
  );
const recipe = z
  .object({
    sources: z
      .array(
        z
          .object({ lotId: id, volumeHl: positive, expectedVolumeHl: positive })
          .strict(),
      )
      .max(50)
      .default([]),
    waterVolumeHl: quantity.default(0),
    products: z.array(product).max(50).default([]),
  })
  .strict();
const common = {
  performedAt: date,
  notes: z.string().max(10000).optional(),
  idempotencyKey: key,
};
export const prepareSchema = z
  .object({
    ...common,
    role: z.enum(["MR", "PCM"]),
    destinationContainerId: id,
    name: z.string().trim().min(1).max(200),
    recipe,
  })
  .strict();
export const inputsSchema = z
  .object({ ...common, snapshot: snapshotSchema, recipe })
  .strict();
export const stepSchema = z
  .object({
    ...common,
    snapshot: snapshotSchema,
    state: z.string().optional(),
    observation: z.string().max(10000).optional(),
  })
  .strict()
  .refine((x) => !!x.state || !!x.observation, "Étape ou observation requise");
export const referenceSchema = z
  .object({ ...common, snapshot: snapshotSchema, analysisId: id })
  .strict();
export const homogenizeSchema = z
  .object({ ...common, snapshot: snapshotSchema, confirmed: z.literal(true) })
  .strict();
export const transferSchema = z
  .object({
    ...common,
    direction: z.enum(["PCM_TO_MR", "MR_TO_PCM"]),
    source: snapshotSchema,
    target: snapshotSchema,
    volumeHl: positive,
    analysisId: id.optional(),
    confirmed: z.literal(true),
  })
  .strict();
export const distributeSchema = z
  .object({
    ...common,
    snapshot: snapshotSchema,
    destinations: z
      .array(
        z
          .object({ lotId: id, snapshot: snapshotSchema, volumeHl: positive })
          .strict(),
      )
      .min(1)
      .max(200),
    initialAnalysisId: id,
    currentAnalysisId: id,
    confirmed: z.literal(true),
  })
  .strict()
  .refine(
    (x) =>
      new Set(x.destinations.map((d) => d.lotId)).size ===
      x.destinations.length,
    "Destination en double",
  );
export const closeSchema = z
  .object({
    ...common,
    status: z.enum(["TERMINE", "ABANDONNE"]),
    snapshots: z.array(snapshotSchema).max(2),
  })
  .strict();
export type CreateMaloDossierInput = z.input<typeof createDossierSchema>;
export type UpdateMaloDossierInput = z.input<typeof updateDossierSchema>;
export type PrepareMaloLotInput = z.input<typeof prepareSchema>;
export type AddMaloInputsInput = z.input<typeof inputsSchema>;
export type RecordMaloStepInput = z.input<typeof stepSchema>;
export type SetMaloReferenceInput = z.input<typeof referenceSchema>;
export type ConfirmMaloHomogenizationInput = z.input<typeof homogenizeSchema>;
export type TransferMaloInput = z.input<typeof transferSchema>;
export type DistributeMaloInput = z.input<typeof distributeSchema>;
export type CloseMaloDossierInput = z.input<typeof closeSchema>;
