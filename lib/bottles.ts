export const MIN_SUR_LATTES_MONTHS = 15;

export const BOTTLE_STATUS_LABELS: Record<string, string> = {
  SUR_LATTES: 'SUR LATTES',
  DEGORGE: 'DEGORGÉ',
  PRET_EXPEDITION: 'PRÊT EXPÉDITION',
  EXPEDIE: 'EXPÉDIÉ',
  RESERVE: 'RÉSERVE',
  ARCHIVE: 'ARCHIVE',
  EN_REMUAGE: 'EN REMUAGE',
  SUR_POINTES: 'SUR POINTES',
  EN_CAVE: 'EN CAVE',
  A_DEGORGER: 'SUR LATTES',
  HABILLE: 'PRÊT EXPÉDITION',
  DEGORGE_TOTALEMENT: 'ARCHIVE',
  HABILLE_TOTALEMENT: 'ARCHIVE',
  EXPEDIE_TOTALEMENT: 'EXPÉDIÉ',
};

export type BottleLotStatusReason =
  | 'MISSING_TIRAGE_DATE'
  | 'STATUS_MISMATCH'
  | 'TOO_YOUNG'
  | 'NO_STOCK'
  | 'OK';

export type BottleLotLike = {
  status?: string | null;
  type?: string | null;
  tirageDate?: string | Date | null;
  currentBottleCount?: number | null;
  currentCount?: number | null;
};

export const getBottleLotCount = (lot: BottleLotLike | null | undefined) =>
  Number(lot?.currentBottleCount ?? lot?.currentCount ?? 0);

export const normalizeBottleLotStatus = (status?: string | null, type?: string | null) => {
  const normalizedStatus = (status ?? '').trim().toUpperCase();
  const normalizedType = (type ?? '').trim().toUpperCase();

  if (normalizedStatus === 'A_DEGORGER') {
    return 'SUR_LATTES';
  }

  if (normalizedStatus === 'HABILLE') {
    return 'PRET_EXPEDITION';
  }

  if (normalizedStatus === 'DEGORGE_TOTALEMENT' || normalizedStatus === 'HABILLE_TOTALEMENT') {
    return 'ARCHIVE';
  }

  if (normalizedStatus === 'EXPEDIE_TOTALEMENT') {
    return 'EXPEDIE';
  }

  if (normalizedStatus === 'EN_CAVE' && normalizedType === 'DEGORGE') {
    return 'DEGORGE';
  }

  return normalizedStatus;
};

export const getBottleStatusLabel = (status?: string | null, type?: string | null) => {
  const normalizedStatus = normalizeBottleLotStatus(status, type);
  return BOTTLE_STATUS_LABELS[normalizedStatus] ?? normalizedStatus.replace(/_/g, ' ');
};

export const calculateBottleLotAgeMonths = (
  tirageDate: string | Date | null | undefined,
  today: string | Date = new Date(),
) => {
  if (!tirageDate) {
    return 0;
  }

  const start = new Date(tirageDate);
  const end = new Date(today);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }

  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12;
  months += end.getUTCMonth() - start.getUTCMonth();

  if (end.getUTCDate() < start.getUTCDate()) {
    months -= 1;
  }

  return Math.max(0, months);
};

export const getDegorgementEligibility = (
  lot: BottleLotLike | null | undefined,
  today: string | Date = new Date(),
) => {
  const normalizedStatus = normalizeBottleLotStatus(lot?.status, lot?.type);
  const stock = getBottleLotCount(lot);
  const ageMonths = calculateBottleLotAgeMonths(lot?.tirageDate, today);

  if (!lot?.tirageDate) {
    return {
      eligible: false,
      reasonCode: 'MISSING_TIRAGE_DATE' as BottleLotStatusReason,
      reason: 'Date de tirage manquante',
      ageMonths,
      normalizedStatus,
    };
  }

  if (normalizedStatus !== 'SUR_LATTES') {
    return {
      eligible: false,
      reasonCode: 'STATUS_MISMATCH' as BottleLotStatusReason,
      reason: `Statut requis: SUR_LATTES`,
      ageMonths,
      normalizedStatus,
    };
  }

  if (stock <= 0) {
    return {
      eligible: false,
      reasonCode: 'NO_STOCK' as BottleLotStatusReason,
      reason: 'Stock nul',
      ageMonths,
      normalizedStatus,
    };
  }

  if (ageMonths < MIN_SUR_LATTES_MONTHS) {
    return {
      eligible: false,
      reasonCode: 'TOO_YOUNG' as BottleLotStatusReason,
      reason: `< ${MIN_SUR_LATTES_MONTHS} mois`,
      ageMonths,
      normalizedStatus,
    };
  }

  return {
    eligible: true,
    reasonCode: 'OK' as BottleLotStatusReason,
    reason: 'Dégorgeable',
    ageMonths,
    normalizedStatus,
  };
};

export const isDegorgementEligibleBottleLot = (
  lot: BottleLotLike | null | undefined,
  today: string | Date = new Date(),
) => getDegorgementEligibility(lot, today).eligible;

export const getHabillageEligibility = (lot: BottleLotLike | null | undefined) => {
  const normalizedStatus = normalizeBottleLotStatus(lot?.status, lot?.type);
  const stock = getBottleLotCount(lot);

  if (normalizedStatus !== 'DEGORGE') {
    return {
      eligible: false,
      reason: 'Statut requis: DEGORGE',
      normalizedStatus,
    };
  }

  if (stock <= 0) {
    return {
      eligible: false,
      reason: 'Stock nul',
      normalizedStatus,
    };
  }

  return {
    eligible: true,
    reason: 'Habillable',
    normalizedStatus,
  };
};

export const isHabillageEligibleBottleLot = (lot: BottleLotLike | null | undefined) =>
  getHabillageEligibility(lot).eligible;

export const getExpeditionEligibility = (lot: BottleLotLike | null | undefined) => {
  const normalizedStatus = normalizeBottleLotStatus(lot?.status, lot?.type);
  const stock = getBottleLotCount(lot);

  if (normalizedStatus !== 'PRET_EXPEDITION') {
    return {
      eligible: false,
      reason: 'Statut requis: PRET_EXPEDITION',
      normalizedStatus,
    };
  }

  if (stock <= 0) {
    return {
      eligible: false,
      reason: 'Stock nul',
      normalizedStatus,
    };
  }

  return {
    eligible: true,
    reason: 'Expédiable',
    normalizedStatus,
  };
};

export const isExpeditionEligibleBottleLot = (lot: BottleLotLike | null | undefined) =>
  getExpeditionEligibility(lot).eligible;
