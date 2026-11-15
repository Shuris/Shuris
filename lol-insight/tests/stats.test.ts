/// <reference types="node" />
/**
 * Testes do motor estatístico (src/stats). Rodar com: npm test
 * Usam partidas montadas à mão, com resultados conferíveis de cabeça.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mockBundles } from '@/data/mock/players';
import { byChampion, byPosition, matchKda, streaks, summarize, wilsonLower, withinDays } from '@/stats/aggregate';
import { computeIdentity } from '@/stats/identity';
import { computeInsights } from '@/stats/insights';
import { absoluteToRank, rankLabel, rankToAbsolute } from '@/stats/rank';
import { consistency, cumulativeWinRate, heatmap, snapshotSeries } from '@/stats/timeseries';
import type { Match, Position } from '@/types';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 15, 12).getTime();

function match(i: number, win: boolean, k: number, d: number, a: number, extra: Partial<Match> = {}): Match {
  return {
    id: `T_${i}`,
    timestamp: NOW - i * DAY,
    durationSec: 1800,
    queue: 'SOLO',
    win,
    championId: 'Zoe',
    position: 'MID' as Position,
    opponentChampionId: 'Ahri',
    kills: k,
    deaths: d,
    assists: a,
    cs: 210,
    gold: 12_600,
    damageDealt: 24_000,
    damageTaken: 15_000,
    visionScore: 21,
    teamKills: 30,
    firstBlood: false,
    items: [],
    trinket: 0,
    runes: { keystone: '', primaryTree: '', primary: [], secondaryTree: '', secondary: [], shards: [] },
    skillOrder: [],
    participants: [],
    objectives: { dragons: 0, barons: 0, heralds: 0, towers: 0, enemyDragons: 0, enemyBarons: 0, enemyTowers: 0 },
    timeline: [],
    ...extra,
  };
}

// 5 partidas: V V D V D → 3 vitórias, 2 derrotas.
const SAMPLE = [
  match(0, false, 2, 6, 4),
  match(1, true, 10, 2, 8, { championId: 'Ahri' }),
  match(2, false, 3, 5, 3, { position: 'JUNGLE', championId: 'LeeSin' }),
  match(3, true, 7, 0, 9),
  match(4, true, 8, 3, 6),
];

test('win rate: vitórias / partidas, e vitórias + derrotas = total', () => {
  const s = summarize(SAMPLE);
  assert.equal(s.games, 5);
  assert.equal(s.wins, 3);
  assert.equal(s.losses, 2);
  assert.equal(s.wins + s.losses, s.games);
  assert.equal(s.winRate, 0.6);
});

test('KDA agregado = (abates + assistências) / mortes', () => {
  const s = summarize(SAMPLE);
  // abates 30, mortes 16, assistências 30
  assert.equal(s.avgKills, 6);
  assert.equal(s.avgDeaths, 3.2);
  assert.equal(s.avgAssists, 6);
  assert.equal(s.kda, 60 / 16);
});

test('KDA de partida sem mortes não divide por zero', () => {
  assert.equal(matchKda(SAMPLE[3]), 16);
  assert.equal(summarize([SAMPLE[3]]).kda, 16);
});

test('médias por minuto usam a duração real', () => {
  const s = summarize(SAMPLE); // 30 min cada
  assert.equal(s.csPerMin, 7);
  assert.equal(s.goldPerMin, 420);
  assert.equal(s.avgDamage, 24_000);
  assert.equal(s.damagePerMin, 800);
  assert.equal(s.killParticipation, 60 / 150);
  assert.equal(s.visionPerMin, 0.7);
  // Partidas de durações diferentes: média ponderada pelo tempo, não média de médias.
  const mixed = summarize([match(0, true, 1, 1, 1, { durationSec: 1200, cs: 60 }), match(1, true, 1, 1, 1, { durationSec: 2400, cs: 300 })]);
  assert.equal(mixed.csPerMin, 360 / 60);
});

test('conjunto vazio: tudo zero, sem NaN', () => {
  const s = summarize([]);
  for (const v of Object.values(s)) assert.equal(v, 0);
});

test('desempenho por campeão e por posição', () => {
  const champs = byChampion(SAMPLE);
  const zoe = champs.find((c) => c.championId === 'Zoe')!;
  assert.deepEqual([zoe.games, zoe.wins, zoe.losses], [3, 2, 1]);
  assert.equal(champs.reduce((n, c) => n + c.games, 0), 5);
  const pos = byPosition(SAMPLE);
  assert.equal(pos.length, 5);
  assert.deepEqual(pos.map((p) => p.games), [0, 1, 4, 0, 0]); // TOP, JUNGLE, MID, ADC, SUPPORT
  assert.equal(pos.find((p) => p.position === 'MID')!.winRate, 0.75);
});

test('desempenho por período: filtra pela data da partida', () => {
  assert.equal(withinDays(SAMPLE, NOW, 2).length, 2); // hoje e ontem
  assert.equal(withinDays(SAMPLE, NOW, 30).length, 5);
  assert.equal(withinDays(SAMPLE, NOW, 2, 2).length, 2); // os dois dias anteriores
});

test('sequências de vitórias e derrotas, em ordem cronológica', () => {
  // cronológico: V V D V D
  assert.deepEqual(streaks(SAMPLE), { longestWin: 2, longestLoss: 1, current: -1 });
  const run = [1, 1, 1, 0, 0, 0, 0, 1].map((w, i) => match(10 - i, !!w, 1, 1, 1));
  assert.deepEqual(streaks(run), { longestWin: 3, longestLoss: 4, current: 1 });
});

test('taxa de vitória acumulada termina igual à taxa geral', () => {
  const series = cumulativeWinRate(SAMPLE);
  assert.equal(series.length, 5);
  assert.equal(series.at(-1)!.y, 60);
  assert.equal(series[0].y, 100); // a mais antiga foi vitória
});

test('consistência e distribuição de KDA somam o total de partidas', () => {
  const c = consistency(SAMPLE);
  assert.equal(c.histogram.reduce((n, b) => n + b.count, 0), 5);
  assert.ok(c.score >= 0 && c.score <= 100);
});

test('mapa de calor: todas as partidas caem em alguma célula', () => {
  const cells = heatmap(SAMPLE);
  assert.equal(cells.length, 56);
  assert.equal(cells.reduce((n, c) => n + c.games, 0), 5);
  assert.equal(cells.reduce((n, c) => n + c.wins, 0), 3);
});

test('amostra insuficiente: sem insights nem identidade inventados', () => {
  const report = computeInsights(SAMPLE);
  assert.equal(report.insights.length, 0);
  assert.equal(report.skipped.length, 1);
  assert.match(report.skipped[0].reason, /ao menos 10 partidas/);
  const identity = computeIdentity(SAMPLE);
  assert.equal(identity.enough, false);
  assert.equal(identity.primary, undefined);
});

test('limite inferior de Wilson penaliza amostras pequenas', () => {
  assert.ok(wilsonLower(2, 2) < wilsonLower(30, 40));
  assert.equal(wilsonLower(0, 0), 0);
});

test('elo: conversão para escala contínua de LP e de volta', () => {
  assert.equal(rankToAbsolute({ tier: 'DIAMANTE', division: 3, lp: 64 }), 2564);
  assert.deepEqual(absoluteToRank(2564), { tier: 'DIAMANTE', division: 3, lp: 64 });
  assert.equal(rankLabel({ tier: 'OURO', division: 4, lp: 0 }), 'Ouro IV');
  assert.equal(rankLabel({ tier: 'GRAO_MESTRE', division: 1, lp: 500 }), 'Grão-Mestre');
  // Mestre, Grão-Mestre e Desafiante compartilham a mesma escala de LP.
  assert.equal(rankToAbsolute({ tier: 'DESAFIANTE', division: 1, lp: 900 }) - rankToAbsolute({ tier: 'MESTRE', division: 1, lp: 100 }), 800);
});

test('série de LP a partir dos snapshots: ordem cronológica e variação entre registros', () => {
  const series = snapshotSeries([
    { t: 3000, queue: 'SOLO', rank: { tier: 'DIAMANTE', division: 3, lp: 85 }, wins: 94, losses: 78 },
    { t: 1000, queue: 'SOLO', rank: { tier: 'DIAMANTE', division: 3, lp: 64 }, wins: 93, losses: 78 },
    { t: 2000, queue: 'FLEX', rank: { tier: 'OURO', division: 1, lp: 10 }, wins: 1, losses: 1 },
  ]);
  assert.deepEqual(series.map((p) => p.y), [2564, 2585]);
  assert.match(series[1].detail, /\+21 LP/);
});

test('dados demonstrativos continuam coerentes e identificados como demonstração', () => {
  for (const b of mockBundles()) {
    assert.equal(b.source, 'demo');
    const s = summarize(b.matches);
    assert.equal(s.wins + s.losses, b.matches.length);
    assert.ok(b.matches.length >= 30);
  }
  const gregory = mockBundles()[0];
  assert.deepEqual(gregory.player.rank, { tier: 'DIAMANTE', division: 3, lp: 64 });
  const last = gregory.matches.filter((m) => m.rankAfter).at(-1)!;
  assert.deepEqual(last.rankAfter, gregory.player.rank);
});
