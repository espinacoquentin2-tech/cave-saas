import { z } from "zod";
import {
  snapshotSchema,
  liqueurSchema,
  quantitySchema,
} from "@/server/modules/levains/levain.schemas";
const id = z.number().int().positive(),
  positive = quantitySchema.refine((v) => v > 0);
export const createMixtionSchema = z
  .object({
    sourceLotId: id,
    baseVolumeHl: positive,
    snapshot: snapshotSchema,
    levainVolumeHl: positive,
    destinationContainerId: id,
    baseSugarGPerL: quantitySchema.refine((v) => v <= 1000),
    levainSugarGPerL: quantitySchema.refine((v) => v <= 1000),
    targetSugarGPerL: positive.refine((v) => v <= 1000),
    sugarSource: z.enum(["SUCRE", "LIQUEUR"]),
    sugarProductId: id.optional(),
    liqueur: liqueurSchema.optional(),
    adjuvants: z
      .array(
        z.object({
          productId: id,
          quantity: positive,
          unit: z.enum(["kg", "g", "L", "hL"]),
          kind: z.literal("OTHER").default("OTHER"),
        }),
      )
      .max(30)
      .default([]),
    idempotencyKey: z.string().uuid(),
  })
  .strict()
  .refine(
    (v) => (v.sugarSource === "SUCRE" ? !!v.sugarProductId : !!v.liqueur),
    "Choisir le sucre ou la liqueur.",
  );
export const checkMixtionSchema = z
  .object({
    lotId: id,
    expectedVolumeHl: positive,
    lastMutationEventId: id,
    performedAt: z.string().datetime({ offset: true }),
    wineDensity20: z.number().finite().min(800).max(1300),
    mixtionDensity20: z.number().finite().min(800).max(1300),
    operatorConfirmed: z.literal(true),
    comment: z.string().trim().max(1000).default(""),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export type CreateMixtionInput = z.infer<typeof createMixtionSchema>;
export type CheckMixtionInput = z.infer<typeof checkMixtionSchema>;
