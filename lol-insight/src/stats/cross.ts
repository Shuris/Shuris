import type { Match, Position } from '@/types';

import { chronological, groupBy, matchCsPerMin, matchKda, matchKp, newestFirst, summarize, type Summary } from './aggregate';
import { dateShort, dec, pct } from './format';
import type { SeriesPoint } from './timeseries';

/**
 * Cruzamentos usados pela central de análise da versão web. Funções puras: a
 * interface decide, com os mínimos de amostra, o que pode ser mostrado.
 */

export interface CellStat {
  games: number;
  wins: number;
}

export interface MatrixRow {
  championId: string;
  total: CellStat;
  cells: Partial<Record<Position, CellStat>>;
}

/** Taxa de vitória por campeão × posição (campeões ordenados por partidas). */
export function championPositionMatrix(matches: Match[], top = 10): MatrixRow[] {
  return [...groupBy(matches, (m) => m.championId)]
    .map(([championId, list]) => {
      const cells: MatrixRow['cells'] = {};
      for (const m of list) {
        const c = (cells[m.position] ??= { games: 0, wins: 0 });
        c.games++;
        if (m.win) c.wins++;
      }
      return { championId, total: { games: list.length, wins: list.filter((m) => m.win).length }, cells };
    })
    .sort((a, b) => b.total.games - a.total.games)
    .slice(0, top);
}

export interface BucketSummary {
  key: string;
  label: string;
  summary: Summary;
}

/** Resumo por faixa (ex.: duração da partida). */
export function byBuckets(matches: Match[], buckets: Array<{ key: string; label: string; test: (m: Match) => boolean }>): BucketSummary[] {
  return buckets.map((b) => ({ key: b.key, label: b.label, summary: summarize(matches.filter(b.test)) }));
}

/** Vitórias × derrotas: o que muda entre os dois resultados. */
export function byResult(matches: Match[]): { win: Summary; loss: Summary } {
  return { win: summarize(matches.filter((m) => m.win)), loss: summarize(matches.filter((m) => !m.win)) };
}

/** Últimos N jogos (mais recentes primeiro): N pedido, quantos existem e o resumo. */
export function lastN(matches: Match[], ns: number[] = [10, 20, 50, 100]): Array<{ n: number; available: number; summary: Summary }> {
  const recent = newestFirst(matches);
  return ns.map((n) => {
    const slice = recent.slice(0, n);
    return { n, available: slice.length, summary: summarize(slice) };
  });
}

export interface ObjectivesReport {
  games: number;
  avg: { dragons: number; enemyDragons: number; heralds: number; barons: number; enemyBarons: number; towers: number; enemyTowers: number };
  /** Partidas em que se sabe quem derrubou a primeira torre. */
  firstTower: { ours: CellStat; theirs: CellStat };
  /** Parcela dos objetivos da equipe com participação do jogador (quando informado). */
  participation: number | null;
}

export function objectivesReport(matches: Match[]): ObjectivesReport {
  const n = matches.length || 1;
  const avg = (f: (m: Match) => number) => matches.reduce((t, m) => t + f(m), 0) / n;
  const ours: CellStat = { games: 0, wins: 0 };
  const theirs: CellStat = { games: 0, wins: 0 };
  let teamObj = 0;
  let mine = 0;
  for (const m of matches) {
    const ft = m.timeline.find((e) => e.kind === 'TOWER' && /primeira torre/.test(e.text));
    if (ft) {
      const c = ft.positive ? ours : theirs;
      c.games++;
      if (m.win) c.wins++;
    }
    if (m.objectives.playerParticipations !== undefined) {
      teamObj += m.objectives.dragons + m.objectives.barons + m.objectives.heralds;
      mine += m.objectives.playerParticipations;
    }
  }
  return {
    games: matches.length,
    avg: {
      dragons: avg((m) => m.objectives.dragons),
      enemyDragons: avg((m) => m.objectives.enemyDragons),
      heralds: avg((m) => m.objectives.heralds),
      barons: avg((m) => m.objectives.barons),
      enemyBarons: avg((m) => m.objectives.enemyBarons),
      towers: avg((m) => m.objectives.towers),
      enemyTowers: avg((m) => m.objectives.enemyTowers),
    },
    firstTower: { ours, theirs },
    participation: teamObj > 0 ? Math.min(1, mine / teamObj) : null,
  };
}

export type SeriesMetric = 'kda' | 'csPerMin' | 'goldPerMin' | 'damagePerMin' | 'killParticipation' | 'visionPerMin';

const PER_MATCH: Record<SeriesMetric, { get: (m: Match) => number; fmt: (v: number) => string; label: string }> = {
  kda: { get: matchKda, fmt: (v) => dec(v, 2), label: 'KDA' },
  csPerMin: { get: matchCsPerMin, fmt: (v) => dec(v, 1), label: 'CS/min' },
  goldPerMin: { get: (m) => m.gold / (m.durationSec / 60), fmt: (v) => dec(v, 0), label: 'Ouro/min' },
  damagePerMin: { get: (m) => m.damageDealt / (m.durationSec / 60), fmt: (v) => dec(v, 0), label: 'Dano/min' },
  killParticipation: { get: (m) => matchKp(m) * 100, fmt: (v) => `${dec(v, 0)}%`, label: 'Participação' },
  visionPerMin: { get: (m) => m.visionScore / (m.durationSec / 60), fmt: (v) => dec(v, 2), label: 'Visão/min' },
};

/** Valor da métrica partida a partida (ordem cronológica) + média móvel de `window` partidas. */
export function metricSeries(matches: Match[], metric: SeriesMetric, window = 5): { points: SeriesPoint[]; moving: number[]; average: number; label: string; fmt: (v: number) => string } {
  const def = PER_MATCH[metric];
  // Farm: o suporte não entra (a função dele não é farmar).
  const list = chronological(metric === 'csPerMin' ? matches.filter((m) => m.position !== 'SUPPORT') : matches);
  const values = list.map(def.get);
  const points: SeriesPoint[] = list.map((m, i) => ({
    y: values[i],
    xLabel: dateShort(m.timestamp),
    title: dateShort(m.timestamp),
    detail: `${def.label} ${def.fmt(values[i])} · ${m.win ? 'vitória' : 'derrota'}`,
    t: m.timestamp,
    win: m.win,
  }));
  const moving = values.map((_, i) => {
    const s = values.slice(Math.max(0, i - window + 1), i + 1);
    return s.reduce((a, b) => a + b, 0) / s.length;
  });
  const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  return { points, moving, average, label: def.label, fmt: def.fmt };
}

export const winRateText = (c: CellStat) => (c.games ? pct(c.wins / c.games) : '—');
