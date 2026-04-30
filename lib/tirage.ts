import { BOTTLE_FORMAT_TO_HL } from '@/lib/assemblage';

export const TIRAGE_ELIGIBLE_STATUSES = ['VIN_DE_BASE', 'ASSEMBLAGE', 'ASSEMBLE'] as const;

export const TIRAGE_BOUCHAGE_TYPES = ['CAPSULE', 'LIEGE'] as const;
export const TIRAGE_STOCK_ITEM_KINDS = [
  'PACKAGING_BOTTLE',
  'PACKAGING_PRIMARY_CLOSURE',
  'PACKAGING_SECONDARY_CLOSURE',
  'SUGAR',
  'YEAST',
  'ADJUVANT',
  'LEVAIN',
  'WATER',
] as const;

export type TirageEligibleStatus = (typeof TIRAGE_ELIGIBLE_STATUSES)[number];
export type TirageBouchageType = (typeof TIRAGE_BOUCHAGE_TYPES)[number];
export type TirageStockItemKind = (typeof TIRAGE_STOCK_ITEM_KINDS)[number];
export type TirageSugarSource = 'LIQUEUR' | 'SUCRE';
export type TirageDoseUnit = 'g/L' | 'g/hL' | 'kg/hL' | 'mL/hL' | 'L/hL';

export type TirageMixtionInput = {
  baseVolumeHl: number;
  targetPressureBars: number;
  levainPct: number;
  levainSugarGPerL: number;
  sugarSource: TirageSugarSource;
  liqueurSugarGPerL?: number | null;
  baseSugarGPerL?: number;
};

const round = (value: number, precision = 4) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

export const normalizeTirageLotStatus = (status: string | null | undefined) =>
  typeof status === 'string' ? status.trim().toUpperCase() : '';

export const isTirageEligibleLotStatus = (status: string | null | undefined): status is TirageEligibleStatus =>
  (TIRAGE_ELIGIBLE_STATUSES as readonly string[]).includes(normalizeTirageLotStatus(status));

export const normalizeTirageBouchage = (value: string | null | undefined): TirageBouchageType => {
  const normalized = (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

  return normalized === 'LIEGE' ? 'LIEGE' : 'CAPSULE';
};

export const getBottleFormatVolumeHl = (formatCode: string | null | undefined) => BOTTLE_FORMAT_TO_HL[formatCode ?? ''] ?? 0;

export const getBottleFormatVolumeL = (formatCode: string | null | undefined) =>
  round(getBottleFormatVolumeHl(formatCode) * 100, 4);

export const calculateBottleCount = (volumeHl: number, formatCode: string | null | undefined) => {
  const formatHl = getBottleFormatVolumeHl(formatCode);
  if (!Number.isFinite(volumeHl) || volumeHl <= 0 || formatHl <= 0) {
    return 0;
  }

  return Math.floor(volumeHl / formatHl);
};

export const calculateConsumedVolumeHl = (count: number, formatCode: string | null | undefined) => {
  const formatHl = getBottleFormatVolumeHl(formatCode);
  if (!Number.isFinite(count) || count <= 0 || formatHl <= 0) {
    return 0;
  }

  return round(count * formatHl, 4);
};

export const calculateRealConsumedVolumeHl = calculateConsumedVolumeHl;

export const calculateRemainingVolumeHl = (requestedVolumeHl: number, consumedVolumeHl: number) =>
  round(Math.max(0, requestedVolumeHl - consumedVolumeHl), 4);

export const calculateTiragePlan = (input: {
  requestedVolumeHl: number;
  formatCode: string | null | undefined;
}) => {
  const bottleCount = calculateBottleCount(input.requestedVolumeHl, input.formatCode);
  const consumedVolumeHl = calculateConsumedVolumeHl(bottleCount, input.formatCode);
  const remainderVolumeHl = calculateRemainingVolumeHl(input.requestedVolumeHl, consumedVolumeHl);

  return {
    requestedVolumeHl: round(input.requestedVolumeHl, 4),
    bottleCount,
    consumedVolumeHl,
    remainderVolumeHl,
  };
};

export const calculateTargetSugarForPressure = (targetPressureBars: number) =>
  round((targetPressureBars * 4) * (25.4 / 24.0), 4);

export const calculateLevainVolume = (baseVolumeHl: number, levainPct: number) => {
  if (!Number.isFinite(baseVolumeHl) || baseVolumeHl <= 0 || !Number.isFinite(levainPct) || levainPct <= 0) {
    return 0;
  }

  return round(baseVolumeHl * (levainPct / 100), 4);
};

const normalizeUnit = (unit: string | null | undefined) =>
  (unit ?? '')
    .trim()
    .toLowerCase()
    .replace('litres', 'l')
    .replace('litre', 'l')
    .replace('millilitres', 'ml')
    .replace('millilitre', 'ml')
    .replace('grammes', 'g')
    .replace('gramme', 'g')
    .replace('kilogrammes', 'kg')
    .replace('kilogramme', 'kg')
    .replace('unités', 'unites')
    .replace('unité', 'unites');

export const calculateDoseQuantity = (input: {
  dose: number;
  doseUnit: TirageDoseUnit | string | null | undefined;
  treatedVolumeHl: number;
  quantityUnit: string | null | undefined;
}) => {
  const dose = Number(input.dose);
  const treatedVolumeHl = Number(input.treatedVolumeHl);
  const doseUnit = String(input.doseUnit ?? '').trim();
  const quantityUnit = normalizeUnit(input.quantityUnit);

  if (!Number.isFinite(dose) || dose <= 0 || !Number.isFinite(treatedVolumeHl) || treatedVolumeHl <= 0) {
    return 0;
  }

  const [baseUnitRaw, denominatorRaw] = doseUnit.split('/');
  const baseUnit = normalizeUnit(baseUnitRaw);
  const denominator = normalizeUnit(denominatorRaw);

  if (!baseUnit || !denominator || !quantityUnit) {
    return 0;
  }

  let totalInBaseUnit = 0;
  if (denominator === 'hl') {
    totalInBaseUnit = dose * treatedVolumeHl;
  } else if (denominator === 'l') {
    totalInBaseUnit = dose * treatedVolumeHl * 100;
  } else {
    return 0;
  }

  if (baseUnit === quantityUnit) return round(totalInBaseUnit, 4);
  if (baseUnit === 'g' && quantityUnit === 'kg') return round(totalInBaseUnit / 1000, 4);
  if (baseUnit === 'kg' && quantityUnit === 'g') return round(totalInBaseUnit * 1000, 4);
  if (baseUnit === 'ml' && quantityUnit === 'l') return round(totalInBaseUnit / 1000, 4);
  if (baseUnit === 'l' && quantityUnit === 'ml') return round(totalInBaseUnit * 1000, 4);

  return 0;
};

export const calculateSugarDose = (input: {
  volumeHl: number;
  targetPressureBars: number;
  residualSugarGPerL?: number | null;
  quantityUnit?: string | null;
}) => {
  const targetSugarGPerL = calculateTargetSugarForPressure(input.targetPressureBars);
  const residualSugarGPerL = Number(input.residualSugarGPerL ?? 0);
  const additionDoseGPerL = round(Math.max(0, targetSugarGPerL - residualSugarGPerL), 4);
  const quantityTotal = calculateDoseQuantity({
    dose: additionDoseGPerL,
    doseUnit: 'g/L',
    treatedVolumeHl: input.volumeHl,
    quantityUnit: input.quantityUnit ?? 'kg',
  });

  return {
    targetSugarGPerL,
    residualSugarGPerL: round(Math.max(0, residualSugarGPerL), 4),
    additionDoseGPerL,
    quantityTotal,
    quantityUnit: input.quantityUnit ?? 'kg',
  };
};

export const calculateYeastQuantity = (input: {
  treatedVolumeHl: number;
  dose: number;
  doseUnit: TirageDoseUnit | string;
  quantityUnit: string;
}) =>
  calculateDoseQuantity({
    dose: input.dose,
    doseUnit: input.doseUnit,
    treatedVolumeHl: input.treatedVolumeHl,
    quantityUnit: input.quantityUnit,
  });

export const calculateAdjuvantQuantity = (input: {
  treatedVolumeHl: number;
  dose: number;
  doseUnit: TirageDoseUnit | string;
  quantityUnit: string;
}) =>
  calculateDoseQuantity({
    dose: input.dose,
    doseUnit: input.doseUnit,
    treatedVolumeHl: input.treatedVolumeHl,
    quantityUnit: input.quantityUnit,
  });

export const calculatePackagingNeeds = (input: {
  bottleCount: number;
  bouchage: TirageBouchageType | string | null | undefined;
}) => {
  const bottleCount = Number.isFinite(input.bottleCount) && input.bottleCount > 0 ? Math.floor(input.bottleCount) : 0;
  const bouchage = normalizeTirageBouchage(input.bouchage);

  return {
    bottleCount,
    bouchage,
    bottleQuantity: bottleCount,
    primaryClosureQuantity: bottleCount,
    secondaryClosureQuantity: bottleCount,
    primaryClosureKind:
      bouchage === 'CAPSULE' ? ('PACKAGING_PRIMARY_CLOSURE' as TirageStockItemKind) : ('PACKAGING_PRIMARY_CLOSURE' as TirageStockItemKind),
    secondaryClosureKind:
      bouchage === 'CAPSULE' ? ('PACKAGING_SECONDARY_CLOSURE' as TirageStockItemKind) : ('PACKAGING_SECONDARY_CLOSURE' as TirageStockItemKind),
  };
};

export const calculateMixtionVolumes = (input: TirageMixtionInput) => {
  const baseSugar = input.baseSugarGPerL ?? 1;
  const targetSugarGF = calculateTargetSugarForPressure(input.targetPressureBars);
  const volLevain = input.baseVolumeHl * (input.levainPct / 100);
  const volVinLevain = input.baseVolumeHl + volLevain;
  const sucreVinLevain =
    ((input.baseVolumeHl * baseSugar) + (volLevain * input.levainSugarGPerL)) / volVinLevain;
  const sucreManquant = targetSugarGF - sucreVinLevain;

  if (sucreManquant <= 0) {
    return {
      error: 'Le vin contient déjà trop de sucre pour cette pression.',
      targetSugarGF,
      volLevain: round(volLevain, 4),
      volVinLevain: round(volVinLevain, 4),
      sucreVinLevain: round(sucreVinLevain, 4),
      sucreManquant: round(sucreManquant, 4),
    };
  }

  let volLiqueur = 0;
  let poidsSucre = 0;
  let volMixtion = 0;

  if (input.sugarSource === 'LIQUEUR') {
    if (!input.liqueurSugarGPerL || input.liqueurSugarGPerL <= sucreManquant) {
      return {
        error: 'La concentration de liqueur est invalide pour ce calcul.',
        targetSugarGF,
        volLevain: round(volLevain, 4),
        volVinLevain: round(volVinLevain, 4),
        sucreVinLevain: round(sucreVinLevain, 4),
        sucreManquant: round(sucreManquant, 4),
      };
    }

    volLiqueur = (volVinLevain * sucreManquant) / (input.liqueurSugarGPerL - sucreManquant);
    volMixtion = volVinLevain + volLiqueur;
  } else {
    poidsSucre = (volVinLevain * sucreManquant) / (1 - (sucreManquant * 0.00063));
    volMixtion = volVinLevain + (poidsSucre * 0.00063);
  }

  return {
    targetSugarGF,
    volLevain: round(volLevain, 4),
    volVinLevain: round(volVinLevain, 4),
    sucreVinLevain: round(sucreVinLevain, 4),
    sucreManquant: round(sucreManquant, 4),
    volLiqueur: round(volLiqueur, 4),
    poidsSucre: round(poidsSucre, 4),
    volMixtion: round(volMixtion, 4),
    deltaRho: round((targetSugarGF - baseSugar) / 2.5, 4),
  };
};
