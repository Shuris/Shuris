/**
 * LOL Challenge nas contas reais: correção no servidor, uma tentativa por
 * desafio (diário uma vez por dia), fuso horário, ranking opcional e isolamento.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CHALLENGES } from '@/challenge/bank';
import { buildState, dailyChallenge, dayOf } from '@/challenge/engine';

import type { AppError } from '../src/errors.ts';
import { httpClient, setup, signUp } from './helpers.ts';

test('desafio: o servidor corrige, guarda só a primeira resposta e calcula o XP', async () => {
  const ctx = setup();
  const a = await signUp(ctx, 'Ana');
  const c = CHALLENGES.find((x) => x.difficulty === 'medio' && x.id !== dailyChallenge(dayOf(ctx.clock.t)).id)!;
  const wrong = (c.answer + 1) % c.options.length;
  const r1 = ctx.app.challenge.submit(a.userId, { challengeId: c.id, answer: wrong });
  assert.equal(r1.attempt.correct, false);
  assert.equal(r1.attempt.xp, 0);
  // Segunda tentativa no mesmo desafio: não vale nada e devolve a primeira.
  const r2 = ctx.app.challenge.submit(a.userId, { challengeId: c.id, answer: c.answer });
  assert.equal(r2.alreadyAnswered, true);
  assert.equal(r2.attempt.correct, false);
  const other = CHALLENGES.find((x) => x.difficulty === 'dificil' && x.id !== dailyChallenge(dayOf(ctx.clock.t)).id)!;
  assert.equal(ctx.app.challenge.submit(a.userId, { challengeId: other.id, answer: other.answer }).attempt.xp, 30);
  const s = buildState(ctx.app.challenge.attempts(a.userId), dayOf(ctx.clock.t));
  assert.equal(s.xp, 30);
  assert.equal(s.attempts.length, 2);
  assert.throws(() => ctx.app.challenge.submit(a.userId, { challengeId: 'nao-existe', answer: 0 }), (e: AppError) => e.code === 'NOT_FOUND');
  assert.throws(() => ctx.app.challenge.submit(a.userId, { challengeId: c.id, answer: 9 }), (e: AppError) => e.code === 'INVALID_PARAMS');
});

test('desafio diário: vale uma vez por dia, dá bônus, conta a sequência e respeita o fuso', async () => {
  const ctx = setup();
  const a = await signUp(ctx, 'Ana');
  const tz = -180;
  const day1 = dayOf(ctx.clock.t, tz);
  const d1 = dailyChallenge(day1);
  const notDaily = CHALLENGES.find((x) => x.id !== d1.id)!;
  assert.throws(() => ctx.app.challenge.submit(a.userId, { challengeId: notDaily.id, answer: 0, daily: true, tzOffsetMin: tz }), (e: AppError) => e.code === 'INVALID_PARAMS');
  const r = ctx.app.challenge.submit(a.userId, { challengeId: d1.id, answer: d1.answer, daily: true, tzOffsetMin: tz });
  assert.equal(r.attempt.daily, true);
  assert.ok(r.attempt.xp > 15);
  assert.equal(ctx.app.challenge.submit(a.userId, { challengeId: d1.id, answer: d1.answer, daily: true, tzOffsetMin: tz }).alreadyAnswered, true);
  ctx.clock.t += 86_400_000;
  const day2 = dayOf(ctx.clock.t, tz);
  const d2 = dailyChallenge(day2);
  ctx.app.challenge.submit(a.userId, { challengeId: d2.id, answer: (d2.answer + 1) % d2.options.length, daily: true, tzOffsetMin: tz });
  const st = ctx.app.challenge.state(a.userId, tz);
  assert.equal(st.today, day2);
  const s = buildState(st.attempts, st.today);
  assert.equal(s.streak, 2);
  assert.ok(s.dailyAttempt);
  assert.throws(() => ctx.app.challenge.state(a.userId, 5000), (e: AppError) => e.code === 'INVALID_PARAMS');
});

test('ranking: só quem aceitou aparece, com o nome de usuário; dados isolados e apagados com a conta', async () => {
  const ctx = setup();
  const a = await signUp(ctx, 'Ana');
  const b = await signUp(ctx, 'Bia', { ip: '10.0.0.2' });
  const c = await signUp(ctx, 'Caio', { ip: '10.0.0.3' });
  const today = dayOf(ctx.clock.t);
  const pool = CHALLENGES.filter((x) => x.id !== dailyChallenge(today).id);
  pool.slice(0, 3).forEach((x) => ctx.app.challenge.submit(a.userId, { challengeId: x.id, answer: x.answer }));
  pool.slice(0, 1).forEach((x) => ctx.app.challenge.submit(b.userId, { challengeId: x.id, answer: x.answer }));
  pool.slice(0, 5).forEach((x) => ctx.app.challenge.submit(c.userId, { challengeId: x.id, answer: x.answer }));
  ctx.app.challenge.setOptIn(a.userId, true);
  ctx.app.challenge.setOptIn(b.userId, true);
  const call = httpClient(ctx.app);
  const rk = (await call('GET', '/v1/me/challenge/ranking', { token: a.tokens.accessToken })).json;
  assert.deepEqual(rk.entries.map((e: { username: string }) => e.username), ['Ana', 'Bia']);
  assert.equal(rk.you.position, 1);
  assert.ok(!JSON.stringify(rk).includes('@'), 'o ranking não expõe e-mails');
  // Caio não aceitou: vê o ranking, mas não aparece nele.
  const rc = (await call('GET', '/v1/me/challenge/ranking', { token: c.tokens.accessToken })).json;
  assert.equal(rc.optedIn, false);
  assert.equal(rc.you, null);
  // Isolamento: cada um só lê as próprias tentativas.
  assert.equal((await call('GET', '/v1/me/challenge?tz=0', { token: b.tokens.accessToken })).json.attempts.length, 1);
  assert.equal((await call('POST', '/v1/me/challenge/ranking', { token: a.tokens.accessToken, body: { optIn: 'sim' } })).json.error.code, 'INVALID_PARAMS');
  assert.equal((await call('GET', '/v1/me/challenge')).status, 401);
  await ctx.app.auth.deleteAccount(a.auth, a.password);
  assert.equal((ctx.app.db.prepare('SELECT COUNT(*) AS n FROM challenge_progress WHERE user_id = ?').get(a.userId) as { n: number }).n, 0);
  assert.deepEqual(ctx.app.challenge.ranking(b.userId).entries.map((e) => e.username), ['Bia']);
});

test('replay challenge: histórico de análises por usuário, validado e substituído por partida', async () => {
  const ctx = setup();
  const a = await signUp(ctx, 'Ana');
  const b = await signUp(ctx, 'Bia', { ip: '10.0.0.2' });
  const call = httpClient(ctx.app);
  const body = { matchId: 'BR1_3000000100', championId: 'Zoe', answers: [{ momentId: 'obj-18', correct: true }, { momentId: 'lead-12', correct: false }] };
  const saved = await call('POST', '/v1/me/replay-analyses', { token: a.tokens.accessToken, body });
  assert.equal(saved.json.analysis.score, 0.5);
  ctx.clock.t += 1000;
  await call('POST', '/v1/me/replay-analyses', { token: a.tokens.accessToken, body: { ...body, answers: [{ momentId: 'obj-18', correct: true }] } });
  const list = (await call('GET', '/v1/me/replay-analyses', { token: a.tokens.accessToken })).json.analyses;
  assert.equal(list.length, 1);
  assert.equal(list[0].score, 1);
  assert.deepEqual((await call('GET', '/v1/me/replay-analyses', { token: b.tokens.accessToken })).json.analyses, []);
  for (const bad of [{ ...body, matchId: 'x' }, { ...body, answers: [] }, { ...body, answers: [{ momentId: '<script>', correct: true }] }, { ...body, answers: [{ momentId: 'a', correct: 'sim' }] }]) {
    assert.equal((await call('POST', '/v1/me/replay-analyses', { token: a.tokens.accessToken, body: bad })).json.error.code, 'INVALID_PARAMS');
  }
});

test('publicação: CORS restrito às origens configuradas e IP real atrás de proxy', async () => {
  const { createHttpHandler, httpDepsFrom } = await import('../src/http/server.ts');
  const { Readable } = await import('node:stream');
  const ctx = setup();
  const handler = createHttpHandler({ ...httpDepsFrom(ctx.app), allowedOrigins: ['https://app.lolinsight.com.br'], trustProxy: true });
  const call = async (method: string, origin?: string) => {
    let status = 0;
    const set: Record<string, string> = {};
    const req = Object.assign(Readable.from([]), { url: '/health', method, headers: origin ? { origin, 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } : {}, socket: { remoteAddress: '10.0.0.1' } });
    const res = { setHeader: (k: string, v: string) => (set[k] = v), writeHead: (s: number, h: Record<string, string> = {}) => ((status = s), Object.assign(set, h)), end: () => undefined };
    await handler(req as never, res as never);
    return { status, headers: set };
  };
  const ok = await call('GET', 'https://app.lolinsight.com.br');
  assert.equal(ok.headers['Access-Control-Allow-Origin'], 'https://app.lolinsight.com.br');
  const bad = await call('GET', 'https://site-malicioso.example');
  assert.equal(bad.headers['Access-Control-Allow-Origin'], undefined);
  assert.equal((await call('OPTIONS', 'https://site-malicioso.example')).status, 403);
  assert.equal((await call('OPTIONS', 'https://app.lolinsight.com.br')).status, 204);
});
