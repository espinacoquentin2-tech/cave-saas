export const BOTTLE_STATUS_VALUES = [
  'SUR_LATTES',
  'EN_REMUAGE',
  'SUR_POINTES',
  'EN_CAVE',
  'A_DEGORGER',
  'DEGORGE',
  'HABILLE',
  'PRET_EXPEDITION',
  'EXPEDIE',
  'ARCHIVE',
  'DEGORGE_TOTALEMENT',
  'HABILLE_TOTALEMENT',
  'EXPEDIE_TOTALEMENT',
] as const;

export type BottleStatusValue = (typeof BOTTLE_STATUS_VALUES)[number];

export const BOTTLE_STATUS_ROUTE_ALLOWED_TARGETS = ['EN_REMUAGE', 'SUR_POINTES'] as const;

export const BOTTLE_STATUS_ROUTE_TRANSITIONS: Record<string, readonly BottleStatusValue[]> = {
  SUR_LATTES: ['EN_REMUAGE'],
  EN_REMUAGE: ['SUR_POINTES'],
};

export const BOTTLE_STATUS_ROUTE_FORBIDDEN_TARGETS = [
  'A_DEGORGER',
  'DEGORGE',
  'HABILLE',
  'PRET_EXPEDITION',
  'EXPEDIE',
  'ARCHIVE',
] as const;

export const normalizeBottleStatusValue = (status: string | null | undefined) =>
  typeof status === 'string' ? status.trim().toUpperCase() : '';

export const getAllowedBottleStatusRouteTargets = (currentStatus: string | null | undefined) =>
  BOTTLE_STATUS_ROUTE_TRANSITIONS[normalizeBottleStatusValue(currentStatus)] ?? [];

export const isBottleStatusRouteTransitionAllowed = (
  currentStatus: string | null | undefined,
  targetStatus: string | null | undefined,
) => getAllowedBottleStatusRouteTargets(currentStatus).includes(normalizeBottleStatusValue(targetStatus) as BottleStatusValue);
