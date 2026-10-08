import { BusinessLogicError } from "./errors";
import type {
  LevainFeedingParameters,
  LevainFeedingCalculation,
  LevainState,
} from "./levain-types";
export type { LevainFeedingParameters } from "./levain-types";
export const roundLevain = (value: number) => Number(value.toFixed(3));
export function getLevainState(
  lot: { status: string; qualiteLot: string | null },
  legacyNamedLevain = false,
): LevainState | null {
  if (
    lot.qualiteLot !== "LEVAIN" &&
    !legacyNamedLevain &&
    !lot.status.startsWith("LEVAIN_")
  )
    return null;
  if (lot.status === "ARCHIVE") return "ARCHIVE";
  if (
    ["LEVAIN_EN_PREPARATION", "LEVAIN_PRET", "LEVAIN_EN_PROPAGATION"].includes(
      lot.status,
    )
  )
    return lot.status as LevainState;
  return "A_QUALIFIER";
}
export function assertGenericLotMutationAllowed(
  lot: {
    status: string;
    qualiteLot: string | null;
    currentContainer?: { displayName: string } | null;
  },
  operation: "status" | "volume" | "intrants",
): void {
  if (lot.qualiteLot === "MIXTION_TIRAGE")
    throw new BusinessLogicError(
      "Utilisez le parcours mixtion et tirage pour modifier ce lot.",
      409,
    );
  if (
    getLevainState(lot, /LEVAIN/i.test(lot.currentContainer?.displayName ?? ""))
  )
    throw new BusinessLogicError(
      `Utilisez le parcours levain pour modifier ${operation === "status" ? "son état" : operation === "volume" ? "son volume" : "ses apports"}.`,
      409,
    );
}
export function calculateLevainFeeding(
  input: LevainFeedingParameters,
): LevainFeedingCalculation | null {
  const {
    remainingVolumeHl: r,
    finalVolumeHl: f,
    previousDensity: pd,
    currentDensity: cd,
    liqueurSugarGPerL: s,
    wineAlcoholPct: a,
    remainingSugarGPerL: rs,
    levainAlcoholPct: la,
    targetAlcoholPct: ta,
    liqueurAlcoholPct: qa,
  } = input;
  const observed =
      Date.parse(input.currentMeasuredAt) -
      Date.parse(input.previousMeasuredAt),
    horizon =
      Date.parse(input.nextWithdrawalAt) - Date.parse(input.currentMeasuredAt);
  if (
    ![r, f, pd, cd, s, a, rs, la, ta, qa, observed, horizon].every(
      Number.isFinite,
    ) ||
    observed <= 0 ||
    horizon <= 0 ||
    r <= 0 ||
    f <= r ||
    s <= 0 ||
    s > 1000 ||
    a <= 0 ||
    a > 20 ||
    rs < 0 ||
    rs > 1000 ||
    [la, ta, qa].some((v) => v < 0 || v > 20) ||
    pd < cd ||
    cd < 800 ||
    pd > 1300
  )
    return null;
  const consumedSugarGPerL = (pd - cd) * 2.5,
    projectedConsumedSugarGPerL = (consumedSugarGPerL * horizon) / observed;
  const q = (f * (20 + projectedConsumedSugarGPerL) - r * rs) / s;
  const w =
    (f * ta - r * la - q * qa - (f * projectedConsumedSugarGPerL) / 16.8) / a;
  const water = f - r - w - q;
  if (![q, w, water].every(Number.isFinite) || q < 0 || w <= 0 || water < -1e-9)
    return null;
  const wineVolumeHl = roundLevain(w),
    liqueurVolumeHl = roundLevain(q),
    addedVolumeHl = roundLevain(f - r),
    waterVolumeHl = roundLevain(addedVolumeHl - wineVolumeHl - liqueurVolumeHl),
    dapKg = roundLevain((f * 20) / 1000);
  if (
    wineVolumeHl <= 0 ||
    waterVolumeHl < 0 ||
    dapKg <= 0 ||
    (q > 0 && liqueurVolumeHl === 0)
  )
    return null;
  return {
    consumedSugarGPerL,
    projectedConsumedSugarGPerL,
    wineVolumeHl,
    liqueurVolumeHl,
    waterVolumeHl,
    addedVolumeHl,
    dapKg,
  };
}
