import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { test } from 'node:test';

import { LESSONS } from '@/coach/lessons';

import { createApp } from '../src/app.ts';
import { AppError } from '../src/errors.ts';
import { createHttpHandler } from '../src/http/server.ts';
import { silentLogger } from '../src/logger.ts';
import { FakeClock, fakeDdragon, FakeRiot, makeMatch, PUUID, setup, tenMatches, testConfig } from './helpers.ts';

/** Conta com 30 ranqueadas recentes (60% de vitórias) já sincronizadas. */
async function tracked(count = 50) {
  const ctx = setup();
  ctx.riot.matches = Array.from({ length: 30 }, (_, i) => {
    const m = makeMatch(500 - i, { win: i % 5 < 3, kills: 7, deaths: 4, assists: 8, cs: 150 });
    const start = ctx.clock.now() - (i + 1) * 12 * 3_600_000;
    m.info.gameCreation = m.info.gameStartTimestamp = start;
    m.info.gameEndTimestamp = start + m.info.gameDuration * 1000;
    return m;
  });
  await ctx.app.accounts.getBundle('BR', 'Gregory', 'BR1', { count });
  await ctx.app.sync.idle();
  return { ...ctx, count };
}

function http(ctx: Awaited<ReturnType<typeof tracked>>) {
  const handler = createHttpHandler({ accounts: ctx.app.accounts, academy: ctx.app.academy, lessons: ctx.app.lessons, logger: silentLogger, hasApiKey: () => true });
  return async (url: string, method = 'GET', body?: unknown) => {
    let status = 0;
    let text = '';
    const req = Object.assign(Readable.from(body === undefined ? [] : [JSON.stringify(body)]), { url, method, socket: { remoteAddress: '10.0.0.9' } });
    const res = { writeHead: (s: number) => (status = s), end: (b?: string) => (text = b ?? '') };
    await handler(req as never, res as never);
    return { status, json: text ? JSON.parse(text) : null };
  };
}

test('relatório do treinador: diagnóstico, aulas, plano e previsão calculados no backend sobre as partidas armazenadas', async () => {
  const ctx = await tracked();
  const calls = ctx.riot.calls.length;
  const r = await ctx.app.academy.report(PUUID, 50);
  assert.equal(ctx.riot.calls.length, calls, 'o treinador não consulta a Riot: usa o que já foi coletado');
  assert.equal(r.source, 'riot');
  assert.equal(r.playerName, 'Gregory');
  assert.equal(r.diagnosis.sample, 30);
  assert.equal(r.academy.lessonsTotal, LESSONS.length);
  // 150 de CS em 30 minutos no meio = 5,0 CS/min: farm apontado como ponto fraco.
  assert.equal(r.diagnosis.weaknesses[0], 'FARM');
  assert.equal(r.plan?.focus, 'FARM');
  assert.equal(r.academy.recommended[0].lessonId, 'f-last-hit');
  assert.equal(r.prediction.status, 'ok');
  assert.equal(r.prediction.inputs?.rankedGames, 30);
  assert.equal(r.prediction.horizons.length, 3);
  assert.ok(r.prediction.horizons[2].central > r.prediction.currentAbs!, '60% de vitórias projeta subida');
});

test('LP por partida vem dos snapshots de elo registrados pelo backend', async () => {
  const ctx = await tracked();
  const league = ctx.riot.league[0] as { leaguePoints: number; wins: number; losses: number };
  // Cada atualização da conta registra um snapshot: +23 por vitória, −17 por derrota.
  for (const [lp, w, l] of [[87, 94, 78], [110, 95, 78], [93, 95, 79], [76, 95, 80], [99, 96, 80], [82, 96, 81]] as const) {
    ctx.clock.t += 30 * 60_000;
    Object.assign(league, { leaguePoints: lp > 99 ? lp - 100 : lp, wins: w, losses: l, rank: lp > 99 ? 'II' : 'III' });
    await ctx.app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 50, refresh: true });
  }
  assert.equal(ctx.app.lpHistory.history(PUUID).filter((s) => s.queue === 'SOLO').length, 7);
  const est = ctx.app.lpHistory.estimate(PUUID, []);
  assert.equal(est.source, 'observed');
  assert.deepEqual([Math.round(est.gain), Math.round(est.loss)], [23, 17]);
  const r = await ctx.app.academy.report(PUUID, 50);
  assert.equal(r.prediction.inputs?.lpSource, 'observed');
});

test('teste de uma aula: corrigido no servidor e persistido com acertos, erros e tempo', async () => {
  const ctx = await tracked();
  const lesson = LESSONS.find((l) => l.id === 'f-last-hit')!;
  const answers = lesson.quiz.map((q) => q.correct);
  // O plano da semana já existe e começa por esta aula.
  assert.equal((await ctx.app.academy.report(PUUID, 50)).plan!.days[0].lessonId, lesson.id);
  ctx.clock.t += 60_000;
  const { result, report } = await ctx.app.academy.submitAttempt(PUUID, 50, lesson.id, answers, 84.4);
  assert.deepEqual(result, { correct: 3, total: 3, score: 1, passed: true });
  assert.equal(report.academy.lessonsCompleted, 1);
  assert.equal(report.plan!.days[0].done, true);
  assert.ok(!report.academy.recommended.some((x) => x.lessonId === lesson.id), 'aula concluída sai das recomendações');

  const saved = ctx.app.coachStore.loadState(PUUID);
  assert.deepEqual(saved.lessons[lesson.id].attempts.map((a) => [a.correct, a.total, a.durationSec, a.answers]), [[3, 3, 84, answers]]);
  assert.equal(saved.activityDays.length, 1);

  await assert.rejects(ctx.app.academy.submitAttempt(PUUID, 50, lesson.id, [0], 10), (e: AppError) => e.code === 'INVALID_PARAMS');
  await assert.rejects(ctx.app.academy.submitAttempt(PUUID, 50, 'inexistente', [0, 0, 0], 10), (e: AppError) => e.code === 'NOT_FOUND');
});

test('persistência: progresso, diagnósticos, plano, previsões e meta sobrevivem a um reinício do servidor', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'loi-'));
  const file = join(dir, 'coach.db');
  try {
    const riot = new FakeRiot();
    riot.matches = tenMatches();
    const clock = new FakeClock();
    const boot = () => createApp(testConfig({ databaseFile: file }), { fetchImpl: riot.fetch, ddragonFetch: fakeDdragon, clock, logger: silentLogger });

    const first = boot();
    await first.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10 });
    await first.sync.idle();
    const lesson = LESSONS[0];
    await first.academy.submitAttempt(PUUID, 10, lesson.id, lesson.quiz.map((q) => q.correct), 50);
    await first.academy.setGoal(PUUID, 10, { tier: 'MESTRE', division: 1 });
    const before = await first.academy.setPlanDay(PUUID, 10, 5, true);
    assert.deepEqual(first.coachStore.counts(PUUID), { lessons: 1, attempts: 1, diagnoses: 1, plans: 1, predictions: 1, goals: 1 });
    first.db.close();

    const second = boot();
    const after = await second.academy.report(PUUID, 10);
    assert.equal(after.academy.lessonsCompleted, 1);
    assert.equal(after.plan!.id, before.plan!.id);
    assert.equal(after.plan!.days[4].done, true);
    assert.equal(after.goal?.target.tier, 'MESTRE');
    assert.equal(after.predictionHistory.length, 1);
    assert.equal(second.diagnosis.history(PUUID).length, 1);
    assert.equal(second.rankPredictions.history(PUUID).length, 1);
    // Remover a meta também persiste.
    assert.equal((await second.academy.setGoal(PUUID, 10, null)).goal, null);
    assert.equal(second.coachStore.counts(PUUID).goals, 0);
    second.db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('conta nunca pesquisada e amostra pequena: erro claro e nenhuma previsão inventada', async () => {
  const fresh = setup();
  await assert.rejects(fresh.app.academy.report('puuid-desconhecido-0000000000', 20), (e: AppError) => e.code === 'PLAYER_NOT_FOUND');

  fresh.riot.matches = tenMatches().slice(0, 4);
  await fresh.app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10 });
  await fresh.app.sync.idle();
  const r = await fresh.app.academy.report(PUUID, 10);
  assert.equal(r.diagnosis.enough, false);
  assert.deepEqual(r.diagnosis.weaknesses, []);
  assert.equal(r.prediction.status, 'insufficient');
  assert.deepEqual(r.prediction.horizons, []);
  assert.equal(r.predictionHistory.length, 0);
});

test('HTTP do treinador: leitura, escrita e validação', async () => {
  const ctx = await tracked();
  const call = http(ctx);

  const lessons = await call('/v1/academy/lessons');
  assert.equal(lessons.status, 200);
  assert.equal(lessons.json.lessons.length, LESSONS.length);

  const report = await call(`/v1/coach/${PUUID}?count=50`);
  assert.equal(report.status, 200);
  assert.equal(report.json.prediction.status, 'ok');

  const lesson = LESSONS[0];
  const attempt = await call(`/v1/coach/${PUUID}/attempts?count=50`, 'POST', { lessonId: lesson.id, answers: lesson.quiz.map((q) => q.correct), durationSec: 61 });
  assert.equal(attempt.status, 200);
  assert.equal(attempt.json.result.passed, true);
  assert.equal(attempt.json.report.academy.lessonsCompleted, 1);

  const goal = await call(`/v1/coach/${PUUID}/goal?count=50`, 'POST', { rank: { tier: 'DIAMANTE', division: 1 } });
  assert.equal(goal.json.goal.target.tier, 'DIAMANTE');
  assert.ok(goal.json.goal.summary.length >= 2);

  const day = await call(`/v1/coach/${PUUID}/plan-day?count=50`, 'POST', { day: 2, done: true });
  assert.equal(day.json.plan.days[1].done, true);

  assert.equal((await call(`/v1/coach/${PUUID}/goal?count=50`, 'POST', { rank: { tier: 'LENDA', division: 1 } })).json.error.code, 'INVALID_PARAMS');
  assert.equal((await call(`/v1/coach/${PUUID}/plan-day?count=50`, 'POST', { day: 9, done: true })).json.error.code, 'INVALID_PARAMS');
  assert.equal((await call(`/v1/coach/${PUUID}/attempts?count=50`, 'POST', { lessonId: lesson.id, answers: 'abc' })).json.error.code, 'INVALID_PARAMS');
  assert.equal((await call(`/v1/coach/curto?count=50`)).json.error.code, 'INVALID_PARAMS');
  assert.equal((await call(`/v1/coach/${PUUID}?count=33`)).json.error.code, 'INVALID_PARAMS');
  assert.equal((await call(`/v1/coach/${PUUID}/attempts?count=50`, 'POST', { lessonId: lesson.id, answers: [0, 0, 0], extra: 'x'.repeat(5000) })).json.error.code, 'INVALID_PARAMS');
  assert.equal((await call(`/v1/coach/${PUUID}/outra?count=50`, 'POST', {})).status, 404);
});
