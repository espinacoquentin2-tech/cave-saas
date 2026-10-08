export type LevainFeedingParameters = {
  remainingVolumeHl: number;
  finalVolumeHl: number;
  previousDensity: number;
  currentDensity: number;
  liqueurSugarGPerL: number;
  wineAlcoholPct: number;
};

const round = (value: number) => Number(value.toFixed(3));

/** Modèle de nourrissage existant, partagé entre la prévisualisation et le serveur. */
export function calculateLevainFeeding(input: LevainFeedingParameters) {
  const { remainingVolumeHl: remaining, finalVolumeHl: final, previousDensity, currentDensity, liqueurSugarGPerL: sugar, wineAlcoholPct: alcohol } = input;
  if (![remaining, final, previousDensity, currentDensity, sugar, alcohol].every(Number.isFinite) || remaining <= 0 || final <= remaining
    || sugar <= 0 || sugar > 1000 || alcohol <= 0 || alcohol > 20
    || previousDensity < currentDensity || currentDensity < 800 || previousDensity > 1300) return null;

  const consumedSugarGPerL = (previousDensity - currentDensity) * 2.5;
  const liqueur = (final * (20 + consumedSugarGPerL) - remaining * 20) / sugar;
  const liqueurAlcohol = sugar >= 600 ? 6.8 : 7.5;
  const wine = (final * 12 - remaining * 12 - liqueur * liqueurAlcohol - final * consumedSugarGPerL / 16.8) / alcohol;
  const water = final - remaining - wine - liqueur;
  if (![liqueur, wine, water].every(Number.isFinite) || liqueur < 0 || wine <= 0 || water < -1e-9) return null;

  const wineVolumeHl = round(wine);
  const liqueurVolumeHl = round(liqueur);
  // Affecter l'écart d'arrondi à l'eau pour conserver exactement le bilan à 0,001 hL.
  const addedVolumeHl = round(final - remaining);
  const waterVolumeHl = round(addedVolumeHl - wineVolumeHl - liqueurVolumeHl);
  if (wineVolumeHl <= 0 || waterVolumeHl < 0) return null;
  return { consumedSugarGPerL, wineVolumeHl, liqueurVolumeHl, waterVolumeHl, addedVolumeHl, dapKg: round(final * 100 * 20 / 1000) };
}
