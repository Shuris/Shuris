import type { Match } from '@/types';

import { chronological, matchCsPerMin, matchKda, mean, stdDev, summarize, withinDays, type Summary } from './aggregate';
import { dateShort, dateTime, WEEKDAYS } from './format';
import { absoluteLabel, rankToAbsolute } from './rank';

export interface SeriesPoint {
  /** Valor no eixo Y. */
  y: number;
  /** Rótulo curto para o eixo X. */
  xLabel: string;
  /** Título exibido no tooltip (data/intervalo). */
  title: string;
  /** Linhas de detalhe exibidas no tooltip. */
  detail: string;
  win?: boolean;
  /** Instante (epoch ms) do ponto, quando aplicável. */
  t?: number;
}

/** Evolução do elo: um ponto por partida ranqueada Solo/Duo. */
export function lpSeries(matches: Match[]): SeriesPoint[] {
  return chronological(matches)
    .filter((m) => m.rankAfter)
    .map((m) => {
      const abs = rankToAbsolute(m.rankAfter!);
      return {
        y: abs,
        xLabel: dateShort(m.timestamp),
        title: dateTime(m.timestamp),
        detail: `${absoluteLabel(abs)} (${m.lpDelta! > 0 ? '+' : '−'}${Math.abs(m.lpDelta!)} LP)`,
        win: m.win,
        t: m.timestamp,
      };
    });
}

/** Taxa de vitória acumulada, partida a partida, dentro do conjunto informado. */
export function cumulativeWinRate(matches: Match[]): SeriesPoint[] {
  let wins = 0;
  return chronological(matches).map((m, i) => {
    if (m.win) wins++;
    const wr = wins / (i + 1);
    return {
      y: wr * 100,
      xLabel: dateShort(m.timestamp),
      title: dateTime(m.timestamp),
      detail: `${Math.round(wr * 100)}% · ${wins}V ${i + 1 - wins}D em ${i + 1} partidas`,
      win: m.win,
    };
  });
}

/** Taxa de vitória em janela móvel (últimas `window` partidas a cada ponto). */
export function rollingWinRate(matches: Match[], window = 10): SeriesPoint[] {
  const list = chronological(matches);
  const out: SeriesPoint[] = [];
  for (let i = 0; i < list.length; i++) {
    const slice = list.slice(Math.max(0, i - window + 1), i + 1);
    if (slice.length < Math.min(window, 5)) continue;
    const wins = slice.filter((m) => m.win).length;
    out.push({
      y: (wins / slice.length) * 100,
      xLabel: dateShort(list[i].timestamp),
      title: dateTime(list[i].timestamp),
      detail: `${Math.round((wins / slice.length) * 100)}% nas últimas ${slice.length} partidas`,
      win: list[i].win,
      t: list[i].timestamp,
    });
  }
  return out;
}

export interface Bucket {
  start: number;
  end: number;
  summary: Summary;
  label: string;
  title: string;
}

/** Tamanho do agrupamento (em dias) para cada período, mantendo o gráfico legível. */
export const bucketDaysFor = (days: number) => (days <= 15 ? 1 : days <= 30 ? 3 : 7);

/** Agrupa as partidas do período em intervalos de tempo; intervalos vazios são omitidos. */
export function bucketize(matches: Match[], asOf: number, days: number): Bucket[] {
  const size = bucketDaysFor(days);
  const count = Math.ceil(days / size);
  const dayMs = 86_400_000;
  const endOfToday = new Date(asOf);
  const base = new Date(endOfToday.getFullYear(), endOfToday.getMonth(), endOfToday.getDate() + 1).getTime();
  const out: Bucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const end = base - i * size * dayMs;
    const start = end - size * dayMs;
    const list = matches.filter((m) => m.timestamp >= start && m.timestamp < end);
    if (!list.length) continue;
    const last = end - dayMs;
    out.push({
      start,
      end,
      summary: summarize(list),
      label: size === 1 ? `${WEEKDAYS[new Date(start).getDay()]} ${new Date(start).getDate()}` : dateShort(start),
      title: size === 1 ? dateShort(start) : `${dateShort(start)} – ${dateShort(last)}`,
    });
  }
  return out;
}

export function kdaSeries(matches: Match[], asOf: number, days: number): SeriesPoint[] {
  return bucketize(withinDays(matches, asOf, days), asOf, days).map((b) => ({
    y: b.summary.kda,
    xLabel: b.label,
    title: b.title,
    detail: `KDA ${b.summary.kda.toFixed(2).replace('.', ',')} · ${b.summary.games} ${b.summary.games === 1 ? 'partida' : 'partidas'}`,
  }));
}

export interface PeriodComparison {
  current: Summary;
  previous: Summary;
  /** false quando não há partidas no período anterior para comparar. */
  comparable: boolean;
}

export function comparePeriods(matches: Match[], asOf: number, days: number): PeriodComparison {
  const current = summarize(withinDays(matches, asOf, days));
  const previous = summarize(withinDays(matches, asOf, days, days));
  return { current, previous, comparable: previous.games >= 5 && current.games >= 5 };
}

/** CS/min por partida (exclui suporte, onde farm não é o objetivo) + média móvel. */
export function csSeries(matches: Match[]): { points: SeriesPoint[]; moving: number[]; average: number } {
  const list = chronological(matches).filter((m) => m.position !== 'SUPPORT');
  const values = list.map(matchCsPerMin);
  const moving = values.map((_, i) => mean(values.slice(Math.max(0, i - 4), i + 1)));
  return {
    points: list.map((m, i) => ({
      y: values[i],
      xLabel: dateShort(m.timestamp),
      title: dateTime(m.timestamp),
      detail: `${values[i].toFixed(1).replace('.', ',')} CS/min · ${m.cs} CS`,
      win: m.win,
    })),
    moving,
    average: mean(values),
  };
}

export interface ConsistencyReport {
  kdas: number[];
  mean: number;
  median: number;
  stdDev: number;
  /** Coeficiente de variação do KDA (quanto menor, mais consistente). */
  cv: number;
  /** 0–100: quanto maior, mais regular. */
  score: number;
  histogram: Array<{ label: string; from: number; to: number; count: number }>;
}

const BINS: Array<[number, number, string]> = [
  [0, 1, '0–1'],
  [1, 2, '1–2'],
  [2, 3, '2–3'],
  [3, 4, '3–4'],
  [4, 6, '4–6'],
  [6, 9, '6–9'],
  [9, Infinity, '9+'],
];

export function consistency(matches: Match[]): ConsistencyReport {
  const kdas = chronological(matches).map(matchKda);
  const sorted = [...kdas].sort((a, b) => a - b);
  const m = mean(kdas);
  const sd = stdDev(kdas);
  const cv = m > 0 ? sd / m : 0;
  const mid = Math.floor(sorted.length / 2);
  return {
    kdas,
    mean: m,
    median: sorted.length ? (sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) : 0,
    stdDev: sd,
    cv,
    score: Math.round(Math.min(100, Math.max(0, 100 - cv * 70))),
    histogram: BINS.map(([from, to, label]) => ({
      label,
      from,
      to,
      count: kdas.filter((v) => v >= from && v < to).length,
    })),
  };
}

export interface HeatCell {
  day: number;
  block: number;
  games: number;
  wins: number;
  winRate: number | null;
}

export const HEAT_BLOCKS = ['0h', '3h', '6h', '9h', '12h', '15h', '18h', '21h'];
export const HEAT_BLOCK_HOURS = 3;

/** Mapa de calor: dia da semana × faixa de 3 horas. */
export function heatmap(matches: Match[]): HeatCell[] {
  const cells: HeatCell[] = [];
  for (let day = 0; day < 7; day++)
    for (let block = 0; block < 8; block++) cells.push({ day, block, games: 0, wins: 0, winRate: null });
  for (const m of matches) {
    const d = new Date(m.timestamp);
    const cell = cells[d.getDay() * 8 + Math.floor(d.getHours() / HEAT_BLOCK_HOURS)];
    cell.games++;
    if (m.win) cell.wins++;
  }
  for (const c of cells) c.winRate = c.games ? c.wins / c.games : null;
  return cells;
}
