import { z } from "zod";
export const quantitySchema = z.number().finite().nonnegative().max(1_000_000);
const positive = quantitySchema.refine(
  (v) => v > 0,
  "Quantité positive requise.",
);
const id = z.number().int().positive(),
  key = z.string().uuid(),
  date = z.string().datetime({ offset: true });
export const snapshotSchema = z
  .object({
    lotId: id,
    volumeHl: positive,
    status: z.string().min(1),
    lastMutationEventId: id.nullable(),
  })
  .strict();
export const protocolSchema = z
  .object({
    reference: z.string().trim().min(2).max(300),
    text: z.string().trim().min(3).max(10000),
  })
  .strict();
const step = z
  .object({ label: z.string().trim().min(1).max(300), performedAt: date })
  .strict();
export const liqueurSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("PREPARED"),
      productId: id,
      sugarGfPerL: positive.refine((v) => v <= 1000),
      alcoholPct: quantitySchema.refine((v) => v <= 20),
    })
    .strict(),
  z
    .object({
      mode: z.literal("MAKE"),
      sugarProductId: id,
      dissolutionLotId: id,
      sugarGfPerL: positive.refine((v) => v <= 1000),
      dissolutionWineAlcoholPct: positive.refine((v) => v <= 20),
    })
    .strict(),
]);
const product = z
  .object({
    productId: id,
    quantity: positive,
    unit: z.enum(["g", "kg"]),
    kind: z.enum(["LSA", "SUGAR", "DAP", "OTHER"]),
  })
  .strict();
const apports = {
  sourceContainerId: id.optional(),
  volumeHl: quantitySchema.default(0),
  waterVolumeHl: quantitySchema.default(0),
  liqueur: z
    .object({ selection: liqueurSchema, volumeHl: positive })
    .strict()
    .optional(),
  products: z.array(product).max(30).default([]),
};
export const createLevainSchema = z
  .object({
    ...apports,
    sourceContainerId: id,
    volumeHl: positive,
    capacityHl: positive.optional(),
    destinationContainerId: id.optional(),
    protocol: protocolSchema,
    step,
    plan: z.unknown().optional(),
    idempotencyKey: key,
  })
  .strict()
  .refine(
    (v) => v.destinationContainerId !== undefined || v.capacityHl !== undefined,
    "Choisir une cuve ou sa capacité.",
  );
export const preparationSchema = z
  .object({ ...apports, snapshot: snapshotSchema, step, idempotencyKey: key })
  .strict()
  .refine(
    (v) => v.volumeHl === 0 || v.sourceContainerId !== undefined,
    "Choisir le vin source.",
  );
export const measurementsSchema = z
  .object({
    temperatureC: z.number().finite().min(-5).max(45).nullable().default(null),
    density20: z.number().finite().min(800).max(1300).nullable().default(null),
    alcoholPct: z.number().finite().min(0).max(20).nullable().default(null),
    residualSugarGPerL: quantitySchema
      .refine((v) => v <= 1000)
      .nullable()
      .default(null),
    ph: z.number().finite().min(0).max(14).nullable().default(null),
    populationMillionsPerMl: quantitySchema.nullable().default(null),
  })
  .strict();
export const qualifySchema = z
  .object({
    snapshot: snapshotSchema,
    protocolCompleted: z.literal(true),
    performedAt: date,
    measurements: measurementsSchema,
    missingMeasurementsReason: z.string().trim().min(3).max(1000).optional(),
    analysisIds: z.array(id).max(30).default([]),
    legacyResume: z.boolean().default(false),
    protocol: protocolSchema.optional(),
    idempotencyKey: key,
  })
  .strict()
  .refine(
    (v) =>
      !Object.values(v.measurements).some((x) => x === null) ||
      !!v.missingMeasurementsReason,
    "Expliquer les mesures indisponibles.",
  );
export const observationSchema = z
  .object({
    lotId: id,
    performedAt: date,
    measurements: measurementsSchema.optional(),
    intervention: z.enum(["AERATION", "AGITATION"]).optional(),
    comment: z.string().trim().max(1000).default(""),
    idempotencyKey: key,
  })
  .strict()
  .refine(
    (v) =>
      (v.measurements !== undefined &&
        Object.values(v.measurements).some((x) => x !== null)) ||
      v.intervention !== undefined ||
      v.comment.length > 0,
    "Renseigner une observation.",
  );
export const feedLevainSchema = z
  .object({
    sourceContainerId: id,
    levainContainerId: id,
    snapshot: snapshotSchema,
    remainingVolumeHl: positive,
    finalVolumeHl: positive,
    previousDensity: z.number().finite().min(800).max(1300),
    currentDensity: z.number().finite().min(800).max(1300),
    liqueurSugarGPerL: positive.refine((v) => v <= 1000),
    wineAlcoholPct: positive.refine((v) => v <= 20),
    remainingSugarGPerL: quantitySchema.refine((v) => v <= 1000),
    levainAlcoholPct: quantitySchema.refine((v) => v <= 20),
    targetAlcoholPct: positive.refine((v) => v <= 20),
    liqueurAlcoholPct: quantitySchema.refine((v) => v <= 20),
    previousMeasuredAt: date,
    currentMeasuredAt: date,
    nextWithdrawalAt: date,
    liqueur: liqueurSchema,
    dapProductId: id,
    idempotencyKey: key,
  })
  .strict()
  .refine(
    (v) => v.sourceContainerId !== v.levainContainerId,
    "Cuves distinctes requises.",
  );
export type CreateLevainInput = z.infer<typeof createLevainSchema>;
export type PreparationInput = z.infer<typeof preparationSchema>;
export type QualifyLevainInput = z.infer<typeof qualifySchema>;
export type ObservationInput = z.infer<typeof observationSchema>;
export type FeedLevainInput = z.infer<typeof feedLevainSchema>;
export type Apports = Pick<
  PreparationInput,
  "sourceContainerId" | "volumeHl" | "waterVolumeHl" | "liqueur" | "products"
>;
