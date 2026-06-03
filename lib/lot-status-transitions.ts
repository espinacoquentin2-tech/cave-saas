export const LOT_STATUS_VALUES = [
  'MOUT_NON_DEBOURBE',
  'MOUT_DEBOURBE',
  'MACERATION',
  'FERMENTATION_ALCOOLIQUE',
  'FERMENTATION_MALOLACTIQUE',
  'FA_ET_FML',
  'VIN_DE_BASE',
  'VIN_ROUGE',
  'RESERVE',
  'ASSEMBLAGE',
  'ASSEMBLE',
  'BOURBES',
  'LIES',
  'REBECHES',
  'TIRE',
  'MIS_EN_BOUTEILLE',
  'ARCHIVE',
] as const;

export type LotStatusValue = (typeof LOT_STATUS_VALUES)[number];

export const MANUAL_LOT_STATUS_TRANSITIONS: Record<string, readonly LotStatusValue[]> = {
  MOUT_DEBOURBE: ['FERMENTATION_ALCOOLIQUE'],
  FERMENTATION_ALCOOLIQUE: ['FERMENTATION_MALOLACTIQUE', 'FA_ET_FML', 'VIN_DE_BASE'],
  FERMENTATION_MALOLACTIQUE: ['VIN_DE_BASE'],
  FA_ET_FML: ['VIN_DE_BASE'],
};

export const FORBIDDEN_MANUAL_LOT_STATUS_TARGETS = [
  'TIRE',
  'MIS_EN_BOUTEILLE',
  'ARCHIVE',
  'ASSEMBLAGE',
  'ASSEMBLE',
  'DEGORGE',
  'PRET_EXPEDITION',
] as const;

export const normalizeLotStatus = (status: string | null | undefined) =>
  typeof status === 'string' ? status.trim().toUpperCase() : '';

export const getAllowedManualLotStatusTargets = (currentStatus: string | null | undefined) =>
  MANUAL_LOT_STATUS_TRANSITIONS[normalizeLotStatus(currentStatus)] ?? [];

export const isKnownLotStatus = (status: string | null | undefined): status is LotStatusValue =>
  (LOT_STATUS_VALUES as readonly string[]).includes(normalizeLotStatus(status));

export const isManualLotStatusTransitionAllowed = (
  currentStatus: string | null | undefined,
  newStatus: string | null | undefined,
) => getAllowedManualLotStatusTargets(currentStatus).includes(normalizeLotStatus(newStatus) as LotStatusValue);
