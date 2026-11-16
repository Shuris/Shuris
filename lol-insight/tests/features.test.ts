/// <reference types="node" />
/**
 * Testes das funcionalidades novas: relatório pós-partida (zonas do mapa,
 * pontos principais, dados demonstrativos), comparação entre jogadores e
 * caderno de matchups.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LESSONS } from '../src/coach';
import { demoAnalysis } from '../src/data/mock/analysis';
import { mockBundles } from '../src/data/mock/players';
import { compareSides } from '../src/stats/compare';
import { buildMatchReport, zoneOf } from '../src/stats/matchReport';
import type { Match, MatchAnalysis } from '../src/types';

const bundle = mockBundles()[0];
const base = bundle.matches[bundle.matches.length - 1];

function withAnalysis(over: Partial<MatchAnalysis>, match: Partial<Match> = {}): [Match, MatchAnalysis] {
  const m: Match = { ...base, durationSec: 30 * 60, win: false, kills: 2, deaths: 5, assists: 3, teamKills: 20, timeline: [], ...match };
  const frames = Array.from({ length: 31 }, (_, i) => ({ minute: i, goldDiff: 0, csDiff: 0, xpDiff: 0, cs: i * 7 }));
  const a: MatchAnalysis = { frames, deaths: [], kills: [], wardsPlaced: Array.from({ length: 14 }, (_, i) => i * 2), wardsKilled: [], playerTeam: 'BLUE', ...over };
  return [m, a];
}

test('zonas do mapa do ponto de vista de cada equipe', () => {
  assert.equal(zoneOf({ x: 0.08, y: 0.08 }, 'BLUE'), 'OWN_BASE');
  assert.equal(zoneOf({ x: 0.08, y: 0.08 }, 'RED'), 'ENEMY_BASE');
  assert.equal(zoneOf({ x: 0.05, y: 0.6 }, 'BLUE'), 'TOP');
  assert.equal(zoneOf({ x: 0.7, y: 0.05 }, 'BLUE'), 'BOT');
  assert.equal(zoneOf({ x: 0.5, y: 0.52 }, 'BLUE'), 'MID');
  assert.equal(zoneOf({ x: 0.3, y: 0.7 }, 'BLUE'), 'RIVER');
  assert.equal(zoneOf({ x: 0.25, y: 0.45 }, 'BLUE'), 'OWN_JUNGLE');
  assert.equal(zoneOf({ x: 0.25, y: 0.45 }, 'RED'), 'ENEMY_JUNGLE');
});

test('relatório: atraso na rota, mortes cedo e no rio viram os pontos principais, com aulas existentes', () => {
  const frames = Array.from({ length: 31 }, (_, i) => ({ minute: i, goldDiff: -90 * i, csDiff: -2 * i, xpDiff: 0, cs: i * 6 }));
  const deaths = [
    { x: 0.3, y: 0.7, minute: 5.2, enemiesInvolved: 2 },
    { x: 0.68, y: 0.32, minute: 9.8, enemiesInvolved: 2 },
    { x: 0.7, y: 0.6, minute: 12.1, enemiesInvolved: 1 },
    { x: 0.5, y: 0.5, minute: 22, enemiesInvolved: 2 },
  ];
  const [m, a] = withAnalysis({ frames, deaths }, { position: 'MID', deaths: 4 });
  const r = buildMatchReport(m, a, 'DIAMANTE');
  assert.equal(r.complete, true);
  assert.deepEqual(r.at15, { minute: 15, gold: -1350, cs: -30 });
  const keys = r.improvements.map((p) => p.key);
  assert.ok(keys.includes('lane-behind'));
  assert.ok(keys.includes('cs-10'));
  assert.ok(keys.includes('early-deaths'));
  assert.ok(keys.includes('exposed-deaths'), keys.join());
  assert.equal(r.points.length, 3);
  assert.ok(r.points.every((p, i, arr) => i === 0 || p.tone === 'good' || arr[i - 1].weight >= p.weight));
  assert.match(r.improvements.find((p) => p.key === 'early-deaths')!.detail, /minutos 5, 9 e 12/);
  const lessonIds = new Set(LESSONS.map((l) => l.id));
  for (const p of [...r.improvements, ...r.strengths]) assert.ok(!p.lessonId || lessonIds.has(p.lessonId), `aula inexistente: ${p.lessonId}`);
  assert.match(r.headline, /^Derrota\./);
});

test('relatório: vantagem na rota e virada aparecem como pontos positivos', () => {
  const frames = Array.from({ length: 31 }, (_, i) => ({ minute: i, goldDiff: i <= 8 ? -150 * i : i <= 15 ? 900 : 1500, csDiff: 0, xpDiff: 0, cs: i * 7 }));
  const [m, a] = withAnalysis({ frames }, { win: true, deaths: 1, kills: 8, assists: 9 });
  const r = buildMatchReport(m, a, 'OURO');
  const good = r.strengths.map((p) => p.key);
  assert.ok(good.includes('lane-ahead'));
  assert.ok(good.includes('comeback'));
  assert.ok(good.includes('few-deaths'));
  assert.equal(r.improvements.length, 0);
  assert.match(r.headline, /^Vitória sólida/);
});

test('relatório: morte pouco antes de um objetivo inimigo, mesmo sem linha do tempo detalhada', () => {
  const m: Match = {
    ...base,
    timeline: [
      { minute: 18, kind: 'DEATH', text: '', positive: false },
      { minute: 19, kind: 'DRAGON', text: '', positive: false },
      { minute: 26, kind: 'DEATH', text: '', positive: false },
      { minute: 27, kind: 'BARON', text: '', positive: false },
      { minute: 30, kind: 'DRAGON', text: '', positive: true },
    ],
  };
  const r = buildMatchReport(m, null);
  assert.equal(r.complete, false);
  const p = r.improvements.find((x) => x.key === 'death-before-objective')!;
  assert.match(p.detail, /2 objetivos \(Dragão aos 19 min, Barão aos 27 min\)/);
  assert.equal(p.lessonId, 'm-arauto-barao');
});

test('dados demonstrativos da linha do tempo: determinísticos e coerentes com o placar', () => {
  for (const b of mockBundles()) {
    for (const m of b.matches.slice(-25)) {
      const a = demoAnalysis(m);
      assert.deepEqual(a, demoAnalysis(m));
      assert.equal(a.deaths.length, m.deaths);
      assert.equal(a.frames.length, Math.floor(m.durationSec / 60) + 1);
      assert.ok(a.deaths.every((d) => d.x >= 0 && d.x <= 1 && d.y >= 0 && d.y <= 1 && d.enemiesInvolved >= 1));
      const r = buildMatchReport(m, a, b.player.rank?.tier);
      assert.ok(r.points.length <= 3);
      assert.ok([...r.improvements, ...r.strengths].every((p) => Number.isFinite(p.weight) && !/NaN|undefined/.test(p.detail)));
    }
  }
});

test('comparação: mesmas métricas lado a lado, vencedor por métrica e radar na mesma referência', () => {
  const [a, b] = mockBundles();
  const cmp = compareSides({ name: 'Você', matches: a.matches, rank: a.player.rank }, { name: b.player.gameName, matches: b.matches, rank: b.player.rank });
  assert.equal(cmp.rows.length, 8);
  for (const r of cmp.rows) {
    assert.ok(Number.isFinite(r.a) && Number.isFinite(r.b));
    if (r.better !== 'tie') assert.notEqual(r.a, r.b);
  }
  const deaths = cmp.rows.find((r) => r.key === 'deaths')!;
  if (deaths.better !== 'tie') assert.equal(deaths.better, deaths.a < deaths.b ? 'a' : 'b');
  assert.ok(cmp.verdicts.length > 0 && cmp.verdicts.length <= 3);
  assert.ok(cmp.verdicts.every((v) => /^(Você|Yuna|\w+) /.test(v) && v.endsWith('.')));
  assert.ok(cmp.radar && cmp.radar.a.length === 7 && cmp.radar.b.length === 7);
  // Comparar alguém consigo mesmo: tudo empatado e sem frases.
  const self = compareSides({ name: 'Você', matches: a.matches, rank: a.player.rank }, { name: 'Eu', matches: a.matches, rank: a.player.rank });
  assert.ok(self.rows.every((r) => r.better === 'tie'));
  assert.deepEqual(self.verdicts, []);
  assert.deepEqual(self.radar!.a, self.radar!.b);
});

test('notificações: textos do resumo semanal, da partida nova e da meta de elo', async () => {
  const { weeklyNotice, matchNotice, goalNotice } = await import('../src/services/notificationContent');
  const w = weeklyNotice(bundle.matches, bundle.asOf)!;
  assert.match(w.body, /^\d+ partidas?, \d+% de vitórias/);
  assert.equal(w.url, '/desempenho');
  assert.match(weeklyNotice(bundle.matches, bundle.asOf + 400 * 86_400_000)!.body, /Nenhuma partida/);

  const m = bundle.matches[0];
  const r = buildMatchReport(m, demoAnalysis(m), bundle.player.rank?.tier);
  const n = matchNotice(m, r, 'Syndra');
  assert.match(n.title, /^(Vitória|Derrota) com Syndra: relatório pronto$/);
  assert.equal(n.url, `/partida/${m.id}`);

  const goal = (distance: number, reached = false) =>
    ({ goal: { target: { tier: 'DIAMANTE', division: 2, lp: 0 }, distance, reached, probability30: 0.62 } }) as unknown as Parameters<typeof goalNotice>[0];
  assert.equal(goalNotice(goal(80)), null);
  assert.match(goalNotice(goal(25))!.body, /Faltam 25 LP\. Chance de chegar em 30 dias: 62%/);
  assert.match(goalNotice(goal(0, true))!.title, /alcançada/);
  assert.equal(goalNotice(null), null);
});
