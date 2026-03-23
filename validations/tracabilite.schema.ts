// validations/tracabilite.schema.ts
import { z } from 'zod';

export const TraceabilityRequestSchema = z.object({
  lotCode: z.string().min(1, "Le code du lot est requis pour générer la traçabilité"),
  type: z.enum(["bulk", "bottle"])
});

export type TraceabilityRequestPayload = z.infer<typeof TraceabilityRequestSchema>;