import { POSITIONS } from '@/data/champions';
import type { Match, Position } from '@/types';

export interface Summary {
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  /** (abates + assistências) / mortes, agregado no período. */
  kda: number;
  csPerMin: number;
  goldPerMin: number;
  avgDamage: number;
  avgDamageTaken: number;
  damagePerMin: number;
  killParticipation: number;
  visionPerMin: number;
  avgDurationSec: number;
}

export const matchKda = (m: Match) => (m.kills + m.assists) / Math.max(1, m.deaths);
export const matchCsPerMin = (m: Match) => m.cs / (m.durationSec / 60);
export const matchKp = (m: Match) => (m.teamKills > 0 ? (m.kills + m.assists) / m.teamKills : 0);

export function summarize(matches: Match[]): Summary {
  const n = matches.length;
  const sum = (f: (m: Match) => number) => matches.reduce((s, m) => s + f(m), 0);
  const wins = matches.filter((m) => m.win).length;
  const k = sum((m) => m.kills);
  const d = sum((m) => m.deaths);
  const a = sum((m) => m.assists);
  const minutes = sum((m) => m.durationSec) / 60;
  const teamKills = sum((m) => m.teamKills);
  const div = (x: number, y: number) => (y > 0 ? x / y : 0);
  return {
    games: n,
    wins,
    losses: n - wins,
    winRate: div(wins, n),
    avgKills: div(k, n),
    avgDeaths: div(d, n),
    avgAssists: div(a, n),
    kda: div(k + a, Math.max(1, d)),
    csPerMin: div(sum((m) => m.cs), minutes),
    goldPerMin: div(sum((m) => m.gold), minutes),
    avgDamage: div(sum((m) => m.damageDealt), n),
    avgDamageTaken: div(sum((m) => m.damageTaken), n),
    damagePerMin: div(sum((m) => m.damageDealt), minutes),
    killParticipation: div(k + a, teamKills),
    visionPerMin: div(sum((m) => m.visionScore), minutes),
    avgDurationSec: div(sum((m) => m.durationSec), n),
  };
}

export function withinDays(matches: Match[], asOf: number, days: number, offsetDays = 0): Match[] {
  const end = asOf - offsetDays * 86_400_000;
  const start = end - days * 86_400_000;
  return matches.filter((m) => m.timestamp > start && m.timestamp <= end);
}

/** Ordena do mais antigo para o mais recente. */
export const chronological = (matches: Match[]) => [...matches].sort((a, b) => a.timestamp - b.timestamp);
export const newestFirst = (matches: Match[]) => [...matches].sort((a, b) => b.timestamp - a.timestamp);

export interface Streaks {
  longestWin: number;
  longestLoss: number;
  /** Positivo = vitórias seguidas atuais; negativo = derrotas seguidas. */
  current: number;
}

export function streaks(matches: Match[]): Streaks {
  let longestWin = 0;
  let longestLoss = 0;
  let run = 0;
  for (const m of chronological(matches)) {
    run = m.win ? (run > 0 ? run + 1 : 1) : run < 0 ? run - 1 : -1;
    if (run > longestWin) longestWin = run;
    if (-run > longestLoss) longestLoss = -run;
  }
  return { longestWin, longestLoss, current: run };
}

export interface ChampionStats extends Summary {
  championId: string;
  bestWinStreak: number;
  mainPosition: Position;
}

export function groupBy<K extends string>(matches: Match[], key: (m: Match) => K): Map<K, Match[]> {
  const map = new Map<K, Match[]>();
  for (const m of matches) {
    const k = key(m);
    const list = map.get(k);
    if (list) list.push(m);
    else map.set(k, [m]);
  }
  return map;
}

export function byChampion(matches: Match[]): ChampionStats[] {
  return [...groupBy(matches, (m) => m.championId)].map(([championId, list]) => {
    const pos = [...groupBy(list, (m) => m.position)].sort((a, b) => b[1].length - a[1].length)[0][0];
    return { championId, ...summarize(list), bestWinStreak: streaks(list).longestWin, mainPosition: pos };
  });
}

export interface PositionStats extends Summary {
  position: Position;
}

export function byPosition(matches: Match[]): PositionStats[] {
  const groups = groupBy(matches, (m) => m.position);
  return POSITIONS.map((position) => ({ position, ...summarize(groups.get(position) ?? []) }));
}

export interface MatchupStats extends Summary {
  opponentId: string;
}

export function matchups(matches: Match[]): MatchupStats[] {
  return [...groupBy(matches, (m) => m.opponentChampionId)]
    .map(([opponentId, list]) => ({ opponentId, ...summarize(list) }))
    .sort((a, b) => b.games - a.games);
}

export type ChampionSort = 'games' | 'winRate' | 'kda' | 'wins';

export function sortChampions(list: ChampionStats[], sort: ChampionSort): ChampionStats[] {
  const key: Record<ChampionSort, (c: ChampionStats) => number> = {
    games: (c) => c.games,
    winRate: (c) => c.winRate,
    kda: (c) => c.kda,
    wins: (c) => c.wins,
  };
  return [...list].sort((a, b) => key[sort](b) - key[sort](a) || b.games - a.games);
}

/**
 * "Seus melhores campeões": ordena por um limite inferior de confiança da taxa de
 * vitória (intervalo de Wilson), que premia win rate alto sem supervalorizar
 * campeões com poucas partidas.
 */
export function wilsonLower(wins: number, n: number, z = 1.28): number {
  if (n === 0) return 0;
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return (centre - margin) / denom;
}

export function bestChampions(list: ChampionStats[], minGames = 8, top = 3): ChampionStats[] {
  return list
    .filter((c) => c.games >= minGames)
    .sort((a, b) => wilsonLower(b.wins, b.games) - wilsonLower(a.wins, a.games))
    .slice(0, top);
}

export function mean(values: number[]): number {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}
