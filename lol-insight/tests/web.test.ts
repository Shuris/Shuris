/// <reference types="node" />
/**
 * Lógica compartilhada da versão web: cruzamentos da central de análise,
 * LOL Challenge (regras, sequência, conquistas), leitura de .rofl e desafios
 * de decisão a partir da linha do tempo.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CHALLENGES } from '../src/challenge/bank';
import { addDays, attemptKey, buildState, dailyChallenge, dayOf, demoHistory, grade, levelFor, xpForLevel } from '../src/challenge/engine';
import { demoCoachState } from '../src/coach/demoSeed';
import { demoAnalysis } from '../src/data/mock/analysis';
import { mockBundles } from '../src/data/mock/players';
import { decisionMoments, didacticMoments } from '../src/replay/decisions';
import { parseRofl, RoflError } from '../src/replay/rofl';
import { summarize } from '../src/stats/aggregate';
import { byBuckets, byResult, championPositionMatrix, lastN, metricSeries, objectivesReport } from '../src/stats/cross';
import { DURATION_BUCKETS } from '../src/web/analytics';

const b = mockBundles()[0];

test('cruzamentos: matriz campeão × posição, faixas de duração, resultado e últimos N somam as partidas', () => {
  const ms = b.matches;
  const matrix = championPositionMatrix(ms, 100);
  assert.equal(matrix.reduce((t, r) => t + r.total.games, 0), ms.length);
  for (const r of matrix) assert.equal(Object.values(r.cells).reduce((t, c) => t + (c?.games ?? 0), 0), r.total.games);
  assert.equal(byBuckets(ms, DURATION_BUCKETS).reduce((t, x) => t + x.summary.games, 0), ms.length);
  const { win, loss } = byResult(ms);
  assert.equal(win.games + loss.games, ms.length);
  assert.equal(win.winRate, 1);
  const n = lastN(ms, [10, 1000]);
  assert.equal(n[0].available, 10);
  assert.equal(n[1].available, ms.length);
  assert.equal(n[1].summary.games, summarize(ms).games);
  const o = objectivesReport(ms);
  assert.equal(o.games, ms.length);
  assert.ok(o.firstTower.ours.games + o.firstTower.theirs.games <= ms.length);
  assert.ok(o.participation === null || (o.participation >= 0 && o.participation <= 1));
  const cs = metricSeries(ms, 'csPerMin');
  assert.equal(cs.points.length, ms.filter((m) => m.position !== 'SUPPORT').length, 'suporte não entra no farm');
  assert.equal(cs.moving.length, cs.points.length);
  assert.ok(cs.points.every((p, i, a) => i === 0 || (a[i - 1].t ?? 0) <= (p.t ?? 0)), 'ordem cronológica');
});

test('challenge: nota, XP, diário uma vez por dia, sequência e conquistas', () => {
  const day = '2026-11-16';
  const d = dailyChallenge(day);
  assert.equal(dailyChallenge(day).id, d.id, 'diário determinístico');
  const ok = grade(d.id, d.answer, Date.parse(`${day}T12:00:00Z`), day, true);
  assert.equal(ok.correct, true);
  assert.equal(ok.daily, true);
  assert.ok(ok.xp > 15);
  assert.throws(() => grade(CHALLENGES.find((c) => c.id !== d.id)!.id, 0, 0, day, true), /NOT_TODAYS_DAILY/);
  assert.throws(() => grade('x', 0, 0, day), /UNKNOWN_CHALLENGE/);
  assert.equal(attemptKey(ok), `daily:${day}`);
  // Três dias seguidos de diário → sequência 3, mesmo que um desafio se repita.
  const days = [addDays(day, -2), addDays(day, -1), day];
  const attempts = days.map((x) => grade(dailyChallenge(x).id, dailyChallenge(x).answer, Date.parse(`${x}T12:00:00Z`), x, true));
  const s = buildState(attempts, day);
  assert.equal(s.streak, 3);
  assert.equal(s.bestStreak, 3);
  assert.ok(s.achievements.find((a) => a.id === 'streak3')!.unlocked);
  assert.ok(s.dailyAttempt);
  assert.equal(buildState(attempts.slice(0, 2), addDays(day, 2)).streak, 0, 'sequência quebra depois de um dia sem diário');
  assert.equal(Object.keys(s.calendar).length, 3);
  // Níveis
  assert.equal(levelFor(0).level, 1);
  assert.equal(levelFor(xpForLevel(3)).level, 3);
  assert.ok(levelFor(xpForLevel(3) - 1).level === 2);
  // Respostas certas espalhadas entre as alternativas (não ficam todas na mesma posição).
  const pos = new Set(CHALLENGES.map((c) => c.answer));
  assert.ok(pos.size >= 3);
  assert.equal(new Set(CHALLENGES.map((c) => c.id)).size, CHALLENGES.length);
  assert.equal(CHALLENGES.length, 30);
});

test('challenge demo: histórico fictício marcado, com acertos e erros, sem repetir chaves', () => {
  const h = demoHistory('2026-11-16');
  assert.ok(h.length > 10 && h.every((a) => a.seeded));
  assert.equal(new Set(h.map(attemptKey)).size, h.length);
  const correct = h.filter((a) => a.correct).length;
  assert.ok(correct > 0 && correct < h.length, 'mistura acertos e erros');
  assert.ok(h.every((a) => a.day < '2026-11-16'), 'nada no dia de hoje');
  const s = buildState(h, '2026-11-16');
  assert.ok(s.streak >= 6, `sequência ${s.streak}`);
  assert.equal(dayOf(Date.parse('2026-11-16T02:00:00Z'), -180), '2026-11-15', 'fuso de Brasília');
});

test('academy demo: progresso fictício coerente (aulas concluídas e uma reprovação)', () => {
  const st = demoCoachState(Date.parse('2026-11-16T12:00:00Z'));
  const done = Object.values(st.lessons).filter((l) => l.completedAt);
  assert.equal(done.length, 5);
  assert.equal(st.lessons['t-derrotas'].attempts.length, 2);
  assert.ok(st.activityDays.length >= 5);
});

/** Monta um .rofl sintético: assinatura RIOT, bytes binários e o JSON de metadados. */
function fakeRofl(atEnd: boolean): Uint8Array {
  const stats = [
    { RIOT_ID_GAME_NAME: 'Gregory', RIOT_ID_TAG_LINE: 'BR1', SKIN: 'Zoe', TEAM: '100', WIN: 'Win', CHAMPIONS_KILLED: '9', NUM_DEATHS: '3', ASSISTS: '6', MINIONS_KILLED: '220', NEUTRAL_MINIONS_KILLED: '12', GOLD_EARNED: '13000', TOTAL_DAMAGE_DEALT_TO_CHAMPIONS: '30582', VISION_SCORE: '21', INDIVIDUAL_POSITION: 'MIDDLE', LEVEL: '17' },
    { NAME: 'Rival', SKIN: 'LeBlanc', TEAM: '200', WIN: 'Fail', CHAMPIONS_KILLED: '3', NUM_DEATHS: '9', ASSISTS: '2' },
  ];
  const meta = JSON.stringify({ gameLength: 1850000, gameVersion: '15.22.1', lastGameChunkId: 30, statsJson: JSON.stringify(stats) });
  const head = new TextEncoder().encode('RIOT\u0000\u0000');
  const junk = new Uint8Array(5000).map((_, i) => (i * 37) % 251);
  const body = new TextEncoder().encode(meta);
  const parts = atEnd ? [head, junk, body, new Uint8Array([1, 2, 3, 4])] : [head, body, junk];
  const out = new Uint8Array(parts.reduce((t, p) => t + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

test('replay: lê os metadados do .rofl (início ou fim do arquivo) e recusa arquivos inválidos', () => {
  for (const atEnd of [false, true]) {
    const m = parseRofl(fakeRofl(atEnd));
    assert.equal(m.gameLengthSec, 1850);
    assert.equal(m.gameVersion, '15.22.1');
    assert.equal(m.players.length, 2);
    assert.deepEqual([m.players[0].name, m.players[0].champion, m.players[0].team, m.players[0].win, m.players[0].cs], ['Gregory#BR1', 'Zoe', 'BLUE', true, 232]);
    assert.deepEqual([m.players[1].name, m.players[1].team, m.players[1].win], ['Rival', 'RED', false]);
  }
  assert.throws(() => parseRofl(new TextEncoder().encode('não é um replay de verdade')), RoflError);
  const noMeta = new Uint8Array(200);
  noMeta.set(new TextEncoder().encode('RIOT'), 0);
  assert.throws(() => parseRofl(noMeta), /metadados/);
});

test('replay: momentos de decisão vêm de eventos reais da partida e dizem o que aconteceu', () => {
  let total = 0;
  for (const m of b.matches.slice(0, 40)) {
    const a = demoAnalysis(m);
    const moments = decisionMoments(m, a);
    total += moments.length;
    for (const d of moments) {
      assert.ok(d.real);
      assert.ok(d.answer >= 0 && d.answer < d.options.length);
      assert.ok(d.happened.length > 10);
      assert.ok(d.minute >= 0 && d.minute <= m.durationSec / 60 + 1);
    }
    assert.ok(moments.length <= 4);
  }
  assert.ok(total > 20, 'há momentos suficientes nas partidas demonstrativas');
  assert.equal(decisionMoments(b.matches[0], null).length, 0, 'sem linha do tempo, nenhum momento é inventado');
  assert.ok(didacticMoments().every((d) => !d.real));
});
