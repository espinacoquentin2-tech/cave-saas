import type { LiqueurPreparation } from "./levain-types";
export function calculateLiqueurPreparation(
  volumeHl: number,
  sugarGfPerL: number,
  wineAlcoholPct: number,
): LiqueurPreparation | null {
  if (
    ![volumeHl, sugarGfPerL, wineAlcoholPct].every(Number.isFinite) ||
    volumeHl <= 0 ||
    sugarGfPerL <= 0 ||
    sugarGfPerL > 1000 ||
    wineAlcoholPct <= 0 ||
    wineAlcoholPct > 20
  )
    return null;
  const sugarKg = (volumeHl * 100 * sugarGfPerL) / 1060,
    dissolutionWineVolumeHl = volumeHl - 0.0063 * sugarKg;
  if (dissolutionWineVolumeHl <= 0) return null;
  return {
    volumeHl,
    sugarKg,
    dissolutionWineVolumeHl,
    alcoholPct: (wineAlcoholPct * dissolutionWineVolumeHl) / volumeHl,
  };
}
