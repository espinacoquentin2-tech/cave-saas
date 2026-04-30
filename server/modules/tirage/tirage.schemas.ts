import { z } from 'zod';
import {
  calculateBottleCount,
  calculateConsumedVolumeHl,
  normalizeTirageBouchage,
  TIRAGE_BOUCHAGE_TYPES,
  TIRAGE_STOCK_ITEM_KINDS,
} from '@/lib/tirage';

const decimalPrecision = (value: number) => Number(value.toFixed(3));

export const tirageFormatSchema = z.enum(['37.5cl', '75cl', '150cl', '300cl']);
const tirageBouchageSchema = z.enum(TIRAGE_BOUCHAGE_TYPES);
const tirageStockItemKindSchema = z.enum(TIRAGE_STOCK_ITEM_KINDS);

const tirageStockItemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  kind: tirageStockItemKindSchema.optional(),
  quantity: z.coerce.number().positive().transform(decimalPrecision),
  unit: z.string().trim().min(1).max(20),
  label: z.string().trim().min(1).max(120),
  dose: z.coerce.number().nonnegative().transform(decimalPrecision).nullable().optional(),
  doseUnit: z.string().trim().max(40).nullable().optional(),
  treatedVolumeHl: z.coerce.number().positive().transform(decimalPrecision).nullable().optional(),
  consumeStock: z.coerce.boolean().optional().default(true),
});

const tirageCalculatedItemSchema = z.object({
  kind: tirageStockItemKindSchema,
  productId: z.coerce.number().int().positive().nullable().optional(),
  quantity: z.coerce.number().positive().transform(decimalPrecision),
  unit: z.string().trim().min(1).max(20),
  label: z.string().trim().min(1).max(120),
  dose: z.coerce.number().nonnegative().transform(decimalPrecision).nullable().optional(),
  doseUnit: z.string().trim().max(40).nullable().optional(),
  treatedVolumeHl: z.coerce.number().positive().transform(decimalPrecision).nullable().optional(),
  consumeStock: z.coerce.boolean().optional().default(true),
  note: z.string().trim().max(200).nullable().optional(),
});

const tiragePlanningMetaSchema = z.object({
  source: z.enum(['DIRECT', 'PLANNING']).default('DIRECT'),
  requestedVolumeHl: z.coerce.number().positive().transform(decimalPrecision).nullable().optional(),
  theoreticalConsumedVolumeHl: z.coerce.number().positive().transform(decimalPrecision).nullable().optional(),
  theoreticalRemainderHl: z.coerce.number().min(0).transform(decimalPrecision).nullable().optional(),
  sourceLotCode: z.string().trim().max(120).nullable().optional(),
});

export const createTirageSchema = z
  .object({
    lotId: z.coerce.number().int().positive(),
    sourceContainerId: z.coerce.number().int().positive().nullable().optional(),
    format: tirageFormatSchema,
    count: z.coerce.number().int().positive(),
    volume: z.coerce.number().positive().transform(decimalPrecision),
    bouchage: z
      .union([tirageBouchageSchema, z.string().trim().min(1)])
      .optional()
      .transform((value) => normalizeTirageBouchage(value)),
    zone: z.string().trim().max(120).nullable().optional(),
    tirageDate: z.string().datetime(),
    note: z.string().trim().max(500).nullable().optional(),
    isTranquille: z.coerce.boolean().default(false),
    pressureTargetBars: z.coerce.number().positive().max(12).nullable().optional(),
    wineTemperatureC: z.coerce.number().min(-5).max(40).nullable().optional(),
    residualSugarGPerL: z.coerce.number().min(0).max(500).nullable().optional(),
    stockItems: z.array(tirageStockItemSchema).default([]),
    calculatedItems: z.array(tirageCalculatedItemSchema).default([]),
    planningMeta: tiragePlanningMetaSchema.nullable().optional(),
    idempotencyKey: z.string().uuid(),
  })
  .superRefine((payload, ctx) => {
    const expectedBottleCount = calculateBottleCount(payload.volume, payload.format);
    if (expectedBottleCount !== payload.count) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['count'],
        message: `Le nombre de bouteilles (${payload.count}) est incohérent avec ${payload.volume} hL au format ${payload.format} (${expectedBottleCount} attendues).`,
      });
    }

    const consumedVolume = calculateConsumedVolumeHl(payload.count, payload.format);
    if (consumedVolume <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['format'],
        message: `Le format ${payload.format} ne permet pas de calculer un volume de tirage valide.`,
      });
    }

    const duplicateProductIds = new Set<number>();
    for (const item of payload.stockItems) {
      if (duplicateProductIds.has(item.productId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['stockItems'],
          message: `Le produit #${item.productId} est envoyé plusieurs fois dans le même tirage.`,
        });
      }
      duplicateProductIds.add(item.productId);
    }

    if (payload.calculatedItems.some((item) => item.consumeStock && item.productId == null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['calculatedItems'],
        message: 'Chaque intrant consommé en stock doit référencer un productId.',
      });
    }
  });

export type CreateTirageInput = z.infer<typeof createTirageSchema>;
