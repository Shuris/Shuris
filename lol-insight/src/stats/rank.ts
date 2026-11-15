import type { Rank, Tier } from '@/types';

const TIERS: Tier[] = ['FERRO', 'BRONZE', 'PRATA', 'OURO', 'PLATINA', 'ESMERALDA', 'DIAMANTE', 'MESTRE'];
const TIER_LABEL: Record<Tier, string> = {
  FERRO: 'Ferro',
  BRONZE: 'Bronze',
  PRATA: 'Prata',
  OURO: 'Ouro',
  PLATINA: 'Platina',
  ESMERALDA: 'Esmeralda',
  DIAMANTE: 'Diamante',
  MESTRE: 'Mestre',
};
const ROMAN = ['', 'I', 'II', 'III', 'IV'];

export const TIER_COLOR: Record<Tier, string> = {
  FERRO: '#7A7470',
  BRONZE: '#A8714B',
  PRATA: '#9AA7B4',
  OURO: '#D1A545',
  PLATINA: '#3FA7A0',
  ESMERALDA: '#2FB36B',
  DIAMANTE: '#6C8CFF',
  MESTRE: '#B565D9',
};

/** Converte o elo em uma escala contínua de LP (Ferro IV 0 LP = 0). */
export function rankToAbsolute(r: Rank): number {
  const t = TIERS.indexOf(r.tier);
  if (r.tier === 'MESTRE') return t * 400 + r.lp;
  return t * 400 + (4 - r.division) * 100 + r.lp;
}

export function absoluteToRank(abs: number): Rank {
  const v = Math.max(0, Math.round(abs));
  const masterBase = TIERS.indexOf('MESTRE') * 400;
  if (v >= masterBase) return { tier: 'MESTRE', division: 1, lp: v - masterBase };
  const t = Math.floor(v / 400);
  const rest = v - t * 400;
  const div = (4 - Math.floor(rest / 100)) as 1 | 2 | 3 | 4;
  return { tier: TIERS[t], division: div, lp: rest % 100 };
}

export function rankLabel(r: Rank): string {
  return r.tier === 'MESTRE' ? TIER_LABEL[r.tier] : `${TIER_LABEL[r.tier]} ${ROMAN[r.division]}`;
}

export function rankShort(r: Rank): string {
  return r.tier === 'MESTRE' ? 'M' : `${TIER_LABEL[r.tier][0]}${r.division}`;
}

export function absoluteLabel(abs: number): string {
  const r = absoluteToRank(abs);
  return `${rankLabel(r)} · ${r.lp} LP`;
}
