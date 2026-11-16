import { summarize, withinDays, type Summary } from '@/stats/aggregate';
import { dec, int, pct, signed } from '@/stats/format';
import type { Match } from '@/types';

/** Período em dias; 0 = todas as partidas carregadas. */
export type WebPeriod = 7 | 30 | 90 | 0;
export const PERIODS: ReadonlyArray<{ value: WebPeriod; label: string }> = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
  { value: 0, label: 'Todas' },
];

/** Amostras mínimas para tirar conclusões (abaixo disso a interface avisa e não conclui). */
export const MIN = { trend: 8, champion: 5, matchup: 3, cell: 5, compare: 5 } as const;

export function inPeriod(matches: Match[], asOf: number, period: WebPeriod): Match[] {
  return period ? withinDays(matches, asOf, period) : matches;
}

/** Período imediatamente anterior, de mesmo tamanho (vazio para "Todas"). */
export function previousPeriod(matches: Match[], asOf: number, period: WebPeriod): Match[] {
  return period ? withinDays(matches, asOf, period, period) : [];
}

export interface MetricDef {
  key: string;
  label: string;
  get: (s: Summary) => number;
  fmt: (v: number) => string;
  /** 'up' = maior é melhor. */
  better: 'up' | 'down';
  info?: string;
  /** Como mostrar a diferença entre dois valores. */
  diff: (a: number, b: number) => string;
}

const ppDiff = (a: number, b: number) => `${signed((a - b) * 100, 1)} p.p.`;
const relDiff = (a: number, b: number) => (b > 0 ? `${signed(((a - b) / b) * 100, 0)}%` : '—');

export const METRICS: MetricDef[] = [
  { key: 'winRate', label: 'Taxa de vitória', get: (s) => s.winRate, fmt: (v) => pct(v, 1), better: 'up', diff: ppDiff },
  { key: 'kda', label: 'KDA', get: (s) => s.kda, fmt: (v) => dec(v, 2), better: 'up', diff: relDiff, info: '(abates + assistências) ÷ mortes, somados no período.' },
  { key: 'csPerMin', label: 'CS/min', get: (s) => s.csPerMin, fmt: (v) => dec(v, 1), better: 'up', diff: relDiff, info: 'Tropas e monstros abatidos por minuto.' },
  { key: 'goldPerMin', label: 'Ouro/min', get: (s) => s.goldPerMin, fmt: (v) => int(v), better: 'up', diff: relDiff },
  { key: 'damagePerMin', label: 'Dano/min', get: (s) => s.damagePerMin, fmt: (v) => int(v), better: 'up', diff: relDiff, info: 'Dano causado a campeões por minuto.' },
  { key: 'killParticipation', label: 'Participação em abates', get: (s) => s.killParticipation, fmt: (v) => pct(v), better: 'up', diff: ppDiff, info: 'Parte dos abates da equipe em que você matou ou deu assistência.' },
  { key: 'visionPerMin', label: 'Visão/min', get: (s) => s.visionPerMin, fmt: (v) => dec(v, 2), better: 'up', diff: relDiff },
  { key: 'avgDeaths', label: 'Mortes/partida', get: (s) => s.avgDeaths, fmt: (v) => dec(v, 1), better: 'down', diff: relDiff },
];

export const metric = (key: string) => METRICS.find((m) => m.key === key)!;

/** Variação de uma métrica entre dois períodos, pronta para o componente Kpi. */
export function delta(def: MetricDef, now: Summary, before: Summary | null, against = 'período anterior') {
  if (!before || before.games < MIN.compare || now.games < MIN.compare) return null;
  const a = def.get(now);
  const b = def.get(before);
  if (Math.abs(a - b) < 1e-9) return { text: `igual ao ${against}`, good: null };
  const up = a > b;
  return { text: `${def.diff(a, b)} vs. ${against}`, good: def.better === 'up' ? up : !up };
}

export const summarizeOrNull = (ms: Match[]) => (ms.length ? summarize(ms) : null);

/** Faixas de duração de partida para cruzamentos. */
export const DURATION_BUCKETS = [
  { key: 'curta', label: 'Até 25 min', test: (m: Match) => m.durationSec < 25 * 60 },
  { key: 'media', label: '25 a 32 min', test: (m: Match) => m.durationSec >= 25 * 60 && m.durationSec < 32 * 60 },
  { key: 'longa', label: '32 a 40 min', test: (m: Match) => m.durationSec >= 32 * 60 && m.durationSec < 40 * 60 },
  { key: 'muito-longa', label: '40 min ou mais', test: (m: Match) => m.durationSec >= 40 * 60 },
];
