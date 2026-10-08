export const MIXTION_NON_COMPOSITION_EVENTS = [
  "CONTROLE_MIXTION",
  "TIRAGE",
  "CREATION_TIRAGE",
  "MISE",
  "CREATION_MISE",
];
export type MixtionRecipeParameters = {
  baseVolumeHl: number;
  levainVolumeHl: number;
  baseSugarGPerL: number;
  levainSugarGPerL: number;
  targetSugarGPerL: number;
  sugarSource: "LIQUEUR" | "SUCRE";
  liqueurSugarGPerL?: number;
};
export function calculateMixtionRecipe(
  input: MixtionRecipeParameters,
): { volumeHl: number; liqueurVolumeHl: number; sugarKg: number } | null {
  const {
    baseVolumeHl: b,
    levainVolumeHl: l,
    baseSugarGPerL: bs,
    levainSugarGPerL: ls,
    targetSugarGPerL: t,
  } = input;
  if (
    ![b, l, bs, ls, t].every(Number.isFinite) ||
    b <= 0 ||
    l <= 0 ||
    bs < 0 ||
    ls < 0 ||
    t <= 0 ||
    t > 1000
  )
    return null;
  const missing = t * (b + l) * 100 - bs * b * 100 - ls * l * 100;
  if (missing < 0) return null;
  if (input.sugarSource === "SUCRE") {
    const sugarKg = missing / (1060 - 0.63 * t);
    return { volumeHl: b + l + 0.0063 * sugarKg, liqueurVolumeHl: 0, sugarKg };
  }
  if (
    !Number.isFinite(input.liqueurSugarGPerL) ||
    input.liqueurSugarGPerL! <= t
  )
    return null;
  const liqueurVolumeHl = missing / (input.liqueurSugarGPerL! - t) / 100;
  return { volumeHl: b + l + liqueurVolumeHl, liqueurVolumeHl, sugarKg: 0 };
}
