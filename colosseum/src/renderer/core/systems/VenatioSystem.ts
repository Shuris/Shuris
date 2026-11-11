// Venatio: lutas sazonais contra feras. Não acontecem sempre: alguns dias por
// "temporada" (cerca de 1 em cada 5), sorteados de forma estável por gladiador.
// Vencer uma fera vale bem mais fama que uma luta comum. Uma fera por dia.
import type { PlayerState } from '../model/types';
import type { OpponentDef } from '../data/opponents';
import { daySeed } from '../data/fighters';
import { weekdayIndex } from '../data/locations';
import { createRng } from './rng';

export type BeastKind = 'wolf' | 'boar' | 'bear' | 'lion';

interface BeastInfo {
  kind: BeastKind;
  /** nível mínimo do jogador para essa fera aparecer */
  minLevel: number;
  /** níveis a mais que o jogador */
  plus: number;
  weights: OpponentDef['weights'];
}

export const BEASTS: BeastInfo[] = [
  { kind: 'wolf', minLevel: 1, plus: 1, weights: { str: 1, vit: 0.8, res: 1, agi: 1.8, prec: 1.2, tech: 0.2 } },
  { kind: 'boar', minLevel: 3, plus: 0, weights: { str: 1.6, vit: 1.4, res: 1.2, agi: 0.6, prec: 0.8, tech: 0.2 } },
  { kind: 'bear', minLevel: 6, plus: 0, weights: { str: 2, vit: 1.8, res: 1, agi: 0.4, prec: 0.8, tech: 0.2 } },
  { kind: 'lion', minLevel: 9, plus: 0, weights: { str: 1.7, vit: 1.1, res: 1, agi: 1.5, prec: 1.2, tech: 0.3 } },
];

/** chance de um dia ser de venatio */
export const VENATIO_CHANCE = 0.2;
/** multiplicador de fama ao vencer uma fera */
export const BEAST_FAME_MUL = 2.5;

/** Dia de venatio: nunca no primeiro dia nem aos sábados (torneio). */
export function isVenatioDay(seed: number, day: number): boolean {
  if (day < 3 || weekdayIndex(day) === 6) return false;
  return createRng(daySeed(seed, day, 77))() < VENATIO_CHANCE;
}

/** Próximo dia de venatio a partir de hoje (para o aviso do jornal). */
export function nextVenatioDay(seed: number, day: number): number {
  for (let d = day; d < day + 60; d++) if (isVenatioDay(seed, d)) return d;
  return 0;
}

/** A fera do dia, conforme o nível do jogador. */
export function beastOfDay(p: PlayerState): OpponentDef {
  const rng = createRng(daySeed(p.createdAt, p.day, 78));
  const pool = BEASTS.filter((b) => p.level >= b.minLevel);
  // feras maiores são mais raras
  const pick = pool[Math.min(pool.length - 1, Math.floor(Math.pow(rng(), 0.7) * pool.length))];
  const level = Math.max(1, Math.min(30, p.level + pick.plus));
  return {
    id: `beast_${pick.kind}`,
    name: pick.kind,
    epithet: '',
    description: '',
    level,
    weights: pick.weights,
    equipment: {},
    strategy: 'aggressive',
    paths: ['mars', 'mercury', 'minerva'],
    appearance: { skin: 0, hairStyle: 0, hairColor: 0, beard: false, clothColor: 0 },
    beast: pick.kind,
  };
}

/** Pode enfrentar a fera hoje? (null = pode; senão, a chave do motivo) */
export function venatioCheck(p: PlayerState): 'notToday' | 'done' | null {
  if (!isVenatioDay(p.createdAt, p.day)) return 'notToday';
  if (p.career.beastDay === p.day) return 'done';
  return null;
}
