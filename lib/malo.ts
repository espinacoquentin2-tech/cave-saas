import { Prisma } from '@prisma/client';
import { BusinessLogicError } from './errors';
import type { MaloControlResult } from './malo-types';
export const DEFAULT_MALO_DOSE_PCT = 4;
export const MALO_STATES = { MR: ['MR_EN_PREPARATION','MR_EN_REACTIVATION','MR_TRANSFERE_PARTIELLEMENT','MR_TRANSFERE_TOTALEMENT'], PCM: ['PCM_EN_PREPARATION','PCM_EN_FA','PCM_EN_DEVELOPPEMENT','PCM_EN_DISTRIBUTION','PCM_EPUISE'] } as const;
export function calculateMaloDose(volumeBeforeHl: number, dosePct: number): number {
  if (![volumeBeforeHl,dosePct].every(v => Number.isFinite(v) && v > 0)) throw new BusinessLogicError('Volume et pourcentage positifs requis.');
  const volume = new Prisma.Decimal(volumeBeforeHl).mul(dosePct).div(100).toDecimalPlaces(3).toNumber();
  if (volume <= 0) throw new BusinessLogicError('Dose inférieure à la précision de volume.');
  return volume;
}
export function evaluateMaloControl(initial: number | null, current: number | null, representative: boolean): MaloControlResult {
  const missing = { consumptionPct: null, criterionReached: false };
  if (initial == null || !Number.isFinite(initial) || initial <= 0) return { ...missing, reason: 'REFERENCE_MANQUANTE' };
  if (current == null || !Number.isFinite(current) || current < 0) return { ...missing, reason: 'CONTROLE_MANQUANT' };
  if (!representative) return { ...missing, reason: 'CONTROLE_PERIME' };
  const a = new Prisma.Decimal(initial), b = new Prisma.Decimal(current);
  return { consumptionPct: a.minus(b).mul(100).div(a).toNumber(), criterionReached: b.mul(3).lte(a), reason: null };
}
export function isMaloLot(lot: { maloRole?: string | null }): boolean { return lot.maloRole === 'MR' || lot.maloRole === 'PCM'; }
export function isMaloSourceEligible(lot: { status: string; currentVolume: number; maloRole?: string | null; qualiteLot?: string | null }): boolean {
  return lot.currentVolume > 0 && !isMaloLot(lot) && !['LEVAIN','MIXTION_TIRAGE'].includes(lot.qualiteLot ?? '') && ['MOUT_DEBOURBE','FERMENTATION_ALCOOLIQUE','FA_ET_FML','VIN_DE_BASE','ACTIF','ASSEMBLE','ASSEMBLAGE','RESERVE','VIN_ROUGE'].includes(lot.status);
}
export function assertMaloGenericMutationAllowed(lot: { maloRole?: string | null }, operation: string): void {
  if (isMaloLot(lot)) throw new BusinessLogicError(`Utilisez le dossier Malo pour ${operation} cette préparation.`,409);
}
export function maloControlLabel(reason: MaloControlResult['reason']): string {
  return reason === 'REFERENCE_MANQUANTE' ? 'Référence initiale manquante' : reason === 'CONTROLE_PERIME' ? 'Contrôle antérieur devenu non représentatif' : reason === 'CONTROLE_MANQUANT' ? 'Contrôle manquant' : '';
}
