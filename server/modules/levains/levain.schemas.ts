import { z } from 'zod';

const volume = z.number().finite().positive().max(1_000_000).transform(value => Number(value.toFixed(3))).refine(value => value > 0, 'Le volume minimum est de 0,001 hL.');
const common = { sourceContainerId: z.number().int().positive(), idempotencyKey: z.string().uuid() };
export const createLevainSchema = z.object({ ...common, volumeHl: volume, capacityHl: volume.optional() }).strict()
  .refine(input => input.capacityHl === undefined || input.capacityHl >= input.volumeHl, 'La capacité doit couvrir le volume du levain.');
export const feedLevainSchema = z.object({
  ...common,
  levainContainerId: z.number().int().positive(),
  remainingVolumeHl: volume,
  finalVolumeHl: volume,
  previousDensity: z.number().finite().min(800).max(1300),
  currentDensity: z.number().finite().min(800).max(1300),
  liqueurSugarGPerL: z.number().finite().positive().max(1000),
  wineAlcoholPct: z.number().finite().positive().max(20),
}).strict().refine(input => input.sourceContainerId !== input.levainContainerId, 'Les deux cuves doivent être distinctes.');
export type CreateLevainInput = z.infer<typeof createLevainSchema>;
export type FeedLevainInput = z.infer<typeof feedLevainSchema>;
