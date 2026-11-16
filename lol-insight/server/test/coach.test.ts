import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { LESSONS } from '@/coach/lessons';

import { MemoryMailer } from '../src/auth/mailer.ts';
import { createApp } from '../src/app.ts';
import { AppError } from '../src/errors.ts';
import { silentLogger } from '../src/logger.ts';
import { FakeClock, fakeDdragon, FakeRiot, httpClient, makeMatch, PUUID, setup, signUp, tenMatches, testConfig } from './helpers.ts';

/** Usuário com conta Riot vinculada que tem 30 ranqueadas recentes (60% de vitórias) já sincronizadas. */
async function tracked() {
  const ctx = setup();
  ctx.riot.matches = Array.from({ length: 30 }, (_, i) => {
    const m = makeMatch(500 - i, { win: i % 5 < 3, kills: 7, deaths: 4, assists: 8, cs: 150 });
    const start = ctx.clock.now() - (i + 1) * 12 * 3_600_000;
    m.info.gameCreation = m.info.gameStartTimestamp = start;
    m.info.gameEndTimestamp = start + m.info.gameDuration * 1000;
    return m;
  });
  const user = await signUp(ctx, 'Gregory');
  await ctx.app.riotLinks.link(user.auth, { gameName: 'Gregory', tagLine: 'BR1', region: 'BR' });
  await ctx.app.sync.idle();
  await ctx.app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 50 });
  await ctx.app.sync.idle();
  return { ...ctx, user, userId: user.userId };
}

test('relatório do treinador: calculado no backend sobre as partidas da conta Riot vinculada ao usuário', async () => {
  const ctx = await tracked();
  const calls = ctx.riot.calls.length;
  const r = await ctx.app.academy.report(ctx.userId, 50);
  assert.equal(ctx.riot.calls.length, calls, 'o treinador não consulta a Riot: usa o que já foi coletado');
  assert.equal(r.source, 'riot');
  assert.equal(r.playerName, 'Gregory');
  assert.equal(r.diagnosis.sample, 30);
  assert.equal(r.academy.lessonsTotal, LESSONS.length);
  assert.equal(r.diagnosis.weaknesses[0], 'FARM');
  assert.equal(r.plan?.focus, 'FARM');
  assert.equal(r.academy.recommended[0].lessonId, 'f-last-hit');
  assert.equal(r.prediction.status, 'ok');
  assert.equal(r.prediction.inputs?.rankedGames, 30);
  assert.ok(r.prediction.horizons[2].central > r.prediction.currentAbs!, '60% de vitórias projeta subida');
});

test('sem conta Riot vinculada, o treinador explica o que falta', async () => {
  const ctx = setup();
  const user = await signUp(ctx, 'SemConta');
  await assert.rejects(ctx.app.academy.report(user.userId, 20), (e: AppError) => e.code === 'NO_RIOT_ACCOUNT' && e.status === 409);
});

test('LP por partida vem dos snapshots de elo registrados pelo backend', async () => {
  const ctx = await tracked();
  const league = ctx.riot.league[0] as { leaguePoints: number; wins: number; losses: number };
  for (const [lp, w, l] of [[87, 94, 78], [110, 95, 78], [93, 95, 79], [76, 95, 80], [99, 96, 80], [82, 96, 81]] as const) {
    ctx.clock.t += 30 * 60_000;
    Object.assign(league, { leaguePoints: lp > 99 ? lp - 100 : lp, wins: w, losses: l, rank: lp > 99 ? 'II' : 'III' });
    await ctx.app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 50, refresh: true });
  }
  const est = ctx.app.lpHistory.estimate(PUUID, []);
  assert.equal(est.source, 'observed');
  assert.deepEqual([Math.round(est.gain), Math.round(est.loss)], [23, 17]);
  assert.equal((await ctx.app.academy.report(ctx.userId, 50)).prediction.inputs?.lpSource, 'observed');
});

test('teste de uma aula: corrigido no servidor e persistido para o usuário', async () => {
  const ctx = await tracked();
  const lesson = LESSONS.find((l) => l.id === 'f-last-hit')!;
  const answers = lesson.quiz.map((q) => q.correct);
  assert.equal((await ctx.app.academy.report(ctx.userId, 50)).plan!.days[0].lessonId, lesson.id);
  ctx.clock.t += 60_000;
  const { result, report } = await ctx.app.academy.submitAttempt(ctx.userId, 50, lesson.id, answers, 84.4);
  assert.deepEqual(result, { correct: 3, total: 3, score: 1, passed: true });
  assert.equal(report.academy.lessonsCompleted, 1);
  assert.equal(report.plan!.days[0].done, true);
  const saved = ctx.app.coachStore.loadState(ctx.userId, PUUID);
  assert.deepEqual(saved.lessons[lesson.id].attempts.map((a) => [a.correct, a.total, a.durationSec, a.answers]), [[3, 3, 84, answers]]);
  await assert.rejects(ctx.app.academy.submitAttempt(ctx.userId, 50, lesson.id, [0], 10), (e: AppError) => e.code === 'INVALID_PARAMS');
  await assert.rejects(ctx.app.academy.submitAttempt(ctx.userId, 50, 'inexistente', [0, 0, 0], 10), (e: AppError) => e.code === 'NOT_FOUND');
});

test('isolamento: dois usuários com a mesma conta Riot vinculada têm progressos independentes', async () => {
  const ctx = await tracked();
  const other = await signUp(ctx, 'Yuna');
  await ctx.app.riotLinks.link(other.auth, { gameName: 'Gregory', tagLine: 'BR1', region: 'BR' });
  const lesson = LESSONS[0];
  await ctx.app.academy.submitAttempt(ctx.userId, 50, lesson.id, lesson.quiz.map((q) => q.correct), 30);
  await ctx.app.academy.setGoal(ctx.userId, 50, { tier: 'MESTRE', division: 1 });
  const theirs = await ctx.app.academy.report(other.userId, 50);
  assert.equal(theirs.academy.lessonsCompleted, 0);
  assert.equal(theirs.goal, null);
  assert.equal((await ctx.app.academy.report(ctx.userId, 50)).academy.lessonsCompleted, 1);
});

test('persistência: progresso, plano, previsões e meta sobrevivem a um reinício do servidor', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'loi-'));
  const file = join(dir, 'coach.db');
  try {
    const riot = new FakeRiot();
    riot.matches = tenMatches();
    const clock = new FakeClock();
    const mailer = new MemoryMailer();
    const boot = () => createApp(testConfig({ databaseFile: file }), { fetchImpl: riot.fetch, ddragonFetch: fakeDdragon, clock, logger: silentLogger, mailer });

    const first = boot();
    const user = await signUp({ app: first, mailer }, 'Gregory');
    await first.riotLinks.link(user.auth, { gameName: 'Gregory', tagLine: 'BR1', region: 'BR' });
    await first.sync.idle();
    const lesson = LESSONS[0];
    await first.academy.submitAttempt(user.userId, 10, lesson.id, lesson.quiz.map((q) => q.correct), 50);
    await first.academy.setGoal(user.userId, 10, { tier: 'MESTRE', division: 1 });
    const before = await first.academy.setPlanDay(user.userId, 10, 5, true);
    assert.deepEqual(first.coachStore.counts(user.userId), { lessons: 1, attempts: 1, diagnoses: 1, plans: 1, predictions: 1, goals: 1 });
    first.db.close();

    const second = boot();
    const after = await second.academy.report(user.userId, 10);
    assert.equal(after.academy.lessonsCompleted, 1);
    assert.equal(after.plan!.id, before.plan!.id);
    assert.equal(after.plan!.days[4].done, true);
    assert.equal(after.goal?.target.tier, 'MESTRE');
    assert.equal(second.diagnosis.history(user.userId, PUUID).length, 1);
    assert.equal(second.rankPredictions.history(user.userId, PUUID).length, 1);
    assert.equal((await second.academy.setGoal(user.userId, 10, null)).goal, null);
    second.db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('amostra pequena: nenhuma previsão inventada', async () => {
  const ctx = setup();
  ctx.riot.matches = tenMatches().slice(0, 4);
  const user = await signUp(ctx, 'Gregory');
  await ctx.app.riotLinks.link(user.auth, { gameName: 'Gregory', tagLine: 'BR1', region: 'BR' });
  await ctx.app.sync.idle();
  const r = await ctx.app.academy.report(user.userId, 10);
  assert.equal(r.diagnosis.enough, false);
  assert.equal(r.prediction.status, 'insufficient');
  assert.deepEqual(r.prediction.horizons, []);
});

test('HTTP do treinador: exige login, usa o usuário do token e valida a entrada', async () => {
  const ctx = await tracked();
  const call = httpClient(ctx.app);
  const token = ctx.user.tokens.accessToken;

  assert.equal((await call('GET', '/v1/academy/lessons')).json.lessons.length, LESSONS.length, 'catálogo é público');
  assert.equal((await call('GET', '/v1/me/coach?count=50')).status, 401);
  assert.equal((await call('GET', `/v1/coach/${PUUID}?count=50`, { token })).status, 404, 'a rota antiga por PUUID não existe mais');

  const report = await call('GET', '/v1/me/coach?count=50', { token });
  assert.equal(report.status, 200);
  assert.equal(report.json.prediction.status, 'ok');

  const lesson = LESSONS[0];
  const attempt = await call('POST', '/v1/me/coach/attempts?count=50', { token, body: { lessonId: lesson.id, answers: lesson.quiz.map((q) => q.correct), durationSec: 61 } });
  assert.equal(attempt.json.result.passed, true);
  assert.equal((await call('POST', '/v1/me/coach/goal?count=50', { token, body: { rank: { tier: 'DIAMANTE', division: 1 } } })).json.goal.target.tier, 'DIAMANTE');
  assert.equal((await call('POST', '/v1/me/coach/plan-day?count=50', { token, body: { day: 2, done: true } })).json.plan.days[1].done, true);

  assert.equal((await call('POST', '/v1/me/coach/goal?count=50', { token, body: { rank: { tier: 'LENDA', division: 1 } } })).json.error.code, 'INVALID_PARAMS');
  assert.equal((await call('POST', '/v1/me/coach/plan-day?count=50', { token, body: { day: 9, done: true } })).json.error.code, 'INVALID_PARAMS');
  assert.equal((await call('POST', '/v1/me/coach/attempts?count=50', { token, body: { lessonId: lesson.id, answers: 'abc' } })).json.error.code, 'INVALID_PARAMS');
  assert.equal((await call('GET', '/v1/me/coach?count=33', { token })).json.error.code, 'INVALID_PARAMS');
  assert.equal((await call('POST', '/v1/me/coach/attempts?count=50', { token, body: { lessonId: lesson.id, answers: [0, 0, 0], extra: 'x'.repeat(5000) } })).json.error.code, 'INVALID_PARAMS');
});
