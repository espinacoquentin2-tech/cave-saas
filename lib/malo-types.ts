export type MaloRole = "MR" | "PCM";
export type MaloProfile = "PROGRESSIVE" | "CO_INOCULATION" | "CUSTOM";
export type MaloProductRole = "BACTERIES" | "ACTIVATEUR" | "LSA" | "AUTRE";
export type MaloProductInput = {
  productId: number;
  role: MaloProductRole;
  label?: string;
  quantity: number;
  unit: "g" | "kg" | "L" | "hL";
  addedVolumeHl: number;
};
export type MaloSnapshot = {
  lotId: number;
  volumeHl: number;
  status: string;
  compositionEventId: number | null;
  lastMutationEventId: number | null;
};
export type MaloRecipe = {
  sources: Array<{ lotId: number; volumeHl: number; expectedVolumeHl: number }>;
  waterVolumeHl: number;
  products: MaloProductInput[];
};
export type MaloControlResult = {
  consumptionPct: number | null;
  criterionReached: boolean;
  reason:
    "REFERENCE_MANQUANTE" | "CONTROLE_MANQUANT" | "CONTROLE_PERIME" | null;
};
export type MaloOperationResult = { eventId: number; preparationId: number };
export type MaloProtocol = {
  schemaVersion: 1;
  profile: MaloProfile;
  label: string;
  reference: string;
  mrTemperatureMin: number | null;
  mrTemperatureMax: number | null;
  pcmFaTemperature: number | null;
  pcmFmlTemperature: number | null;
  mrMalicThreshold: number | null;
  mrDays: number | null;
  doublingDays: number | null;
  pcmFirstControlDays: number | null;
  pcmControlIntervalDays: number | null;
  recipientFirstControlDays: number | null;
  preparedPcmPct: number | null;
  notes: string;
};
export type MaloScheduleItem = {
  label: string;
  date: string;
  kind: "MR" | "PCM" | "CUVES";
};
export type MaloAnalysis = {
  id: number;
  lotId: number;
  analysisDate: string;
  ph: number | null;
  at: number | null;
  so2Free: number | null;
  so2Total: number | null;
  alcohol: number | null;
  extraData: Record<string, unknown>;
};
export type MaloEvent = {
  id: number;
  eventType: string;
  eventDatetime: string;
  comment: string | null;
  metadata: Record<string, unknown>;
};
export type MaloControlView = MaloControlResult & {
  initial: MaloAnalysis | null;
  current: MaloAnalysis | null;
  representative: boolean;
};
export type MaloLotView = {
  id: number;
  year?: number;
  name: string;
  role: MaloRole | null;
  status: string;
  volumeHl: number;
  containerId: number | null;
  containerName: string;
  capacityHl: number;
  occupiedVolumeHl?: number;
  snapshot: MaloSnapshot;
  analyses: MaloAnalysis[];
  control?: MaloControlView;
  origin: string;
  homogenized: boolean;
};
export type MaloDossierView = {
  id: number;
  name: string;
  year: number;
  status: string;
  notes: string | null;
  plannedVolumeHl: number;
  dosePct: number;
  protocol: MaloProtocol;
  plannedDestinations: Array<{ lotId: number; dosePct: number }>;
  lots: MaloLotView[];
  events: MaloEvent[];
  schedule: MaloScheduleItem[];
};
export type MaloWorkspace = {
  items: MaloDossierView[];
  sources: MaloLotView[];
  targets: MaloLotView[];
  containers: Array<{
    id: number;
    name: string;
    capacityHl: number;
    usage: string | null;
  }>;
  products: Array<{
    id: number;
    name: string;
    unit: string;
    currentStock: number;
    subCategory: string;
  }>;
};
