export type LevainState =
  | "LEVAIN_EN_PREPARATION"
  | "LEVAIN_PRET"
  | "LEVAIN_EN_PROPAGATION"
  | "ARCHIVE"
  | "A_QUALIFIER";
export type LiqueurSelection =
  | {
      mode: "PREPARED";
      productId: number;
      sugarGfPerL: number;
      alcoholPct: number;
    }
  | {
      mode: "MAKE";
      sugarProductId: number;
      dissolutionLotId: number;
      sugarGfPerL: number;
      dissolutionWineAlcoholPct: number;
    };
export type LevainFeedingParameters = {
  remainingVolumeHl: number;
  finalVolumeHl: number;
  previousDensity: number;
  currentDensity: number;
  liqueurSugarGPerL: number;
  wineAlcoholPct: number;
  remainingSugarGPerL: number;
  levainAlcoholPct: number;
  targetAlcoholPct: number;
  liqueurAlcoholPct: number;
  previousMeasuredAt: string;
  currentMeasuredAt: string;
  nextWithdrawalAt: string;
};
export type LevainFeedingCalculation = {
  consumedSugarGPerL: number;
  projectedConsumedSugarGPerL: number;
  wineVolumeHl: number;
  liqueurVolumeHl: number;
  waterVolumeHl: number;
  addedVolumeHl: number;
  dapKg: number;
};
export type LiqueurPreparation = {
  volumeHl: number;
  sugarKg: number;
  dissolutionWineVolumeHl: number;
  alcoholPct: number;
};
export type PlannedTirageDay = { date: string; baseWineVolumeHl: number };
export type LevainPlanningRow = {
  date: string;
  requiredLevainVolumeHl: number;
  morningVolumeHl: number;
  remainingVolumeHl: number;
  feedingVolumeHl: number;
  intervalDays: number;
};
export type ExpectedLevainSnapshot = {
  lotId: number;
  volumeHl: number;
  status: string;
  lastMutationEventId: number | null;
};
