export const BOTTLE_FORMAT_TO_HL: Record<string, number> = {
  '37.5cl': 0.00375,
  '75cl': 0.0075,
  '150cl': 0.015,
  '300cl': 0.03,
};

export const ASSEMBLAGE_TYPES = [
  'BSA',
  'MILLESIME',
  'BLANC_DE_BLANCS',
  'BLANC_DE_NOIRS',
  'ROSE_D_ASSEMBLAGE',
  'ASSEMBLAGE_LIBRE',
] as const;

export type AssemblageType = (typeof ASSEMBLAGE_TYPES)[number];

export type AssemblageComponentBreakdown = {
  grapeCode: string;
  percentage: number;
};

export type AssemblageDecisionComponent = {
  label: string;
  volumeHl: number;
  vintage?: number | null;
  isReserve?: boolean;
  isRedWine?: boolean;
  cepageBreakdown: AssemblageComponentBreakdown[];
};

export type AssemblageDecision = {
  suggestedType: AssemblageType;
  warnings: string[];
  compositionByCepage: Record<string, number>;
  compositionByVintage: Record<string, number>;
  reserveShare: number;
  redWineShare: number;
  isBlancDeBlancs: boolean;
  isBlancDeNoirs: boolean;
  isMillesimeCandidate: boolean;
  isBsaCandidate: boolean;
  isRoseCandidate: boolean;
  totalVolumeHl: number;
};

const WHITE_GRAPES = new Set(['CH', 'CHARDONNAY', 'ARBANE', 'PETIT MESLIER', 'PINOT BLANC', 'VOLTIS', 'CHARDONNAY ROSE']);
const BLACK_GRAPES = new Set(['PN', 'PINOT NOIR', 'PM', 'MEUNIER', 'PINOT MEUNIER']);

const round = (value: number, precision = 4) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

export const normalizeGrapeCode = (value: string | null | undefined) => {
  if (!value) return 'INCONNU';
  return value.trim().toUpperCase();
};

export const convertBottleCountToHl = (count: number, formatCode: string | null | undefined) => {
  const factor = BOTTLE_FORMAT_TO_HL[formatCode ?? ''] ?? 0;
  return round(count * factor, 4);
};

export const convertHlToBottleCount = (volumeHl: number, formatCode: string | null | undefined) => {
  const factor = BOTTLE_FORMAT_TO_HL[formatCode ?? ''] ?? 0;
  if (!factor) return null;

  const rawCount = volumeHl / factor;
  const roundedCount = Math.round(rawCount);
  if (Math.abs(rawCount - roundedCount) > 0.0001) {
    return null;
  }

  return roundedCount;
};

export const getBottleFormatLabel = (formatCode: string | null | undefined) => {
  if (formatCode === '150cl') return 'Magnum';
  if (formatCode === '75cl') return 'Bouteille 75 cL';
  if (formatCode === '37.5cl') return 'Demi-bouteille';
  if (formatCode === '300cl') return 'Jéroboam';
  return formatCode || 'Bouteille';
};

export const evaluateAssemblageDecision = (
  components: AssemblageDecisionComponent[],
  requestedType?: AssemblageType | null,
): AssemblageDecision => {
  const warnings: string[] = [];
  const compositionByCepage: Record<string, number> = {};
  const compositionByVintage: Record<string, number> = {};
  let reserveVolume = 0;
  let redWineVolume = 0;

  const totalVolumeHl = round(
    components.reduce((sum, component) => sum + (Number.isFinite(component.volumeHl) ? component.volumeHl : 0), 0),
    4,
  );

  if (totalVolumeHl <= 0) {
    return {
      suggestedType: requestedType ?? 'ASSEMBLAGE_LIBRE',
      warnings: ['Aucun volume sélectionné.'],
      compositionByCepage: {},
      compositionByVintage: {},
      reserveShare: 0,
      redWineShare: 0,
      isBlancDeBlancs: false,
      isBlancDeNoirs: false,
      isMillesimeCandidate: false,
      isBsaCandidate: false,
      isRoseCandidate: false,
      totalVolumeHl: 0,
    };
  }

  for (const component of components) {
    const volume = component.volumeHl;
    if (volume <= 0) {
      continue;
    }

    if (component.isReserve) {
      reserveVolume += volume;
    }
    if (component.isRedWine) {
      redWineVolume += volume;
    }

    const breakdown = component.cepageBreakdown.length > 0
      ? component.cepageBreakdown
      : [{ grapeCode: 'INCONNU', percentage: 100 }];

    for (const grape of breakdown) {
      const code = normalizeGrapeCode(grape.grapeCode);
      const grapeVolume = volume * (grape.percentage / 100);
      compositionByCepage[code] = round((compositionByCepage[code] ?? 0) + grapeVolume, 4);
    }

    if (component.vintage != null) {
      const key = String(component.vintage);
      compositionByVintage[key] = round((compositionByVintage[key] ?? 0) + volume, 4);
    }
  }

  const compositionByCepagePct = Object.fromEntries(
    Object.entries(compositionByCepage).map(([grape, volume]) => [grape, round((volume / totalVolumeHl) * 100, 2)]),
  );
  const compositionByVintagePct = Object.fromEntries(
    Object.entries(compositionByVintage).map(([vintage, volume]) => [vintage, round((volume / totalVolumeHl) * 100, 2)]),
  );

  const grapeKeys = Object.keys(compositionByCepagePct);
  const isBlancDeBlancs =
    grapeKeys.length > 0 &&
    grapeKeys.every((grape) => WHITE_GRAPES.has(grape)) &&
    redWineVolume === 0;
  const isBlancDeNoirs =
    grapeKeys.length > 0 &&
    grapeKeys.every((grape) => BLACK_GRAPES.has(grape)) &&
    redWineVolume === 0;
  const reserveShare = round((reserveVolume / totalVolumeHl) * 100, 2);
  const redWineShare = round((redWineVolume / totalVolumeHl) * 100, 2);
  const vintageKeys = Object.keys(compositionByVintagePct);
  const isMillesimeCandidate = vintageKeys.length === 1 && reserveShare === 0;
  const isBsaCandidate = vintageKeys.length > 1 || reserveShare > 0;
  const isRoseCandidate = redWineShare > 0;

  let suggestedType: AssemblageType = 'ASSEMBLAGE_LIBRE';
  if (isRoseCandidate) {
    suggestedType = 'ROSE_D_ASSEMBLAGE';
  } else if (isBlancDeBlancs) {
    suggestedType = 'BLANC_DE_BLANCS';
  } else if (isBlancDeNoirs) {
    suggestedType = 'BLANC_DE_NOIRS';
  } else if (isMillesimeCandidate) {
    suggestedType = 'MILLESIME';
  } else if (isBsaCandidate) {
    suggestedType = 'BSA';
  }

  if (requestedType && requestedType !== 'ASSEMBLAGE_LIBRE' && requestedType !== suggestedType) {
    warnings.push(`Le type demandé (${requestedType}) ne correspond pas au type suggéré (${suggestedType}).`);
  }
  if (isMillesimeCandidate && vintageKeys[0]) {
    warnings.push(`Assemblage candidat millésimé ${vintageKeys[0]}.`);
  }
  if (isBsaCandidate && reserveShare > 0) {
    warnings.push(`Présence de vin de réserve: ${reserveShare.toFixed(2)} %.`);
  }
  if (isRoseCandidate) {
    warnings.push(`Présence de vin rouge: ${redWineShare.toFixed(2)} %.`);
  }

  return {
    suggestedType,
    warnings,
    compositionByCepage: compositionByCepagePct,
    compositionByVintage: compositionByVintagePct,
    reserveShare,
    redWineShare,
    isBlancDeBlancs,
    isBlancDeNoirs,
    isMillesimeCandidate,
    isBsaCandidate,
    isRoseCandidate,
    totalVolumeHl,
  };
};
