import type { LevainState } from "@/lib/levain-types";
export type HistoryEvent = {
  id: number;
  eventType: string;
  eventDatetime: string;
  metadata: {
    idempotencyKey?: string;
    recipe?: Record<string, unknown>;
    productDebits?: Array<{ name: string; quantity: number; unit: string }>;
  };
};
export type LotView = {
  lotId: number;
  name: string;
  containerId: number | null;
  containerName: string;
  status: string;
  state: LevainState | null;
  volumeHl: number;
  capacityHl: number;
  lastMutationEventId: number | null;
  events: HistoryEvent[];
  analyses: unknown[];
  creationEventId?: number;
  compositionEventId?: number | null;
  checked?: boolean;
};
export type ProductView = {
  id: number;
  name: string;
  category: string;
  subCategory: string;
  unit: string;
  currentStock: number;
};
export type LevainData = {
  items: LotView[];
  wines: LotView[];
  mixtions: LotView[];
  products: ProductView[];
  emptyTanks: Array<{ id: number; name: string; capacityHl: number }>;
};
export type Submit = (
  operation: string,
  payload: Record<string, unknown>,
) => Promise<boolean>;
export type PanelProps = {
  data: LevainData;
  submit: Submit;
  busy: boolean;
  plan?: unknown;
};
export const snapshot = (lot: LotView) => ({
  lotId: lot.lotId,
  volumeHl: lot.volumeHl,
  status: lot.status,
  lastMutationEventId: lot.lastMutationEventId,
});
export const stateLabel: Record<string, string> = {
  LEVAIN_EN_PREPARATION: "En préparation",
  LEVAIN_PRET: "Prêt au tirage",
  LEVAIN_EN_PROPAGATION: "En propagation",
  A_QUALIFIER: "À qualifier",
  ARCHIVE: "Épuisé",
};
