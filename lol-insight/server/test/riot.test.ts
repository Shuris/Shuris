import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AppError } from '../src/errors.ts';
import { redact } from '../src/logger.ts';
import { accountHost, matchHost, platformHost, regionFromMatchId, regionFromPlatform } from '../src/regions.ts';
import { RiotClient } from '../src/riot/client.ts';
import { RateLimitExceededError, RateLimiter } from '../src/riot/rateLimiter.ts';
import { FakeClock, FakeRiot, KEY } from './helpers.ts';

const HOST = 'br1.api.riotgames.com';

function client(riot: FakeRiot, clock = new FakeClock(), apiKey = KEY, rules = [{ max: 20, windowMs: 1000 }, { max: 100, windowMs: 120_000 }]) {
  const limiter = new RateLimiter(rules, clock);
  return { c: new RiotClient({ apiKey, limiter, fetchImpl: riot.fetch, clock }), limiter, clock };
}

test('regiões: conta brasileira usa BR1 na plataforma e AMERICAS em contas e partidas', () => {
  assert.equal(platformHost('BR'), 'br1.api.riotgames.com');
  assert.equal(accountHost('BR'), 'americas.api.riotgames.com');
  assert.equal(matchHost('BR'), 'americas.api.riotgames.com');
  assert.equal(platformHost('EUW'), 'euw1.api.riotgames.com');
  assert.equal(matchHost('EUNE'), 'europe.api.riotgames.com');
  assert.equal(matchHost('KR'), 'asia.api.riotgames.com');
  // Oceania: partidas no cluster SEA, contas no cluster mais próximo (não existe Account-V1 em SEA).
  assert.equal(matchHost('OCE'), 'sea.api.riotgames.com');
  assert.equal(accountHost('OCE'), 'asia.api.riotgames.com');
  assert.equal(regionFromPlatform('NA1'), 'NA');
  assert.equal(regionFromMatchId('BR1_3104000000'), 'BR');
  assert.equal(regionFromMatchId('XX_1'), null);
});

test('a chave vai no cabeçalho X-Riot-Token e nunca na URL', async () => {
  const riot = new FakeRiot();
  const { c } = client(riot);
  await c.get(HOST, '/lol/league/v4/entries/by-puuid/abc', { query: { count: 5 } });
  assert.equal(riot.calls[0].key, KEY);
  assert.ok(!riot.calls[0].search.includes('RGAPI'));
  assert.ok(!riot.calls[0].search.includes('api_key'));
});

test('logs mascaram qualquer chave da Riot', () => {
  assert.equal(redact(`falha com ${KEY} no pedido`), 'falha com RGAPI-*** no pedido');
});

test('sem chave: falha com MISSING_API_KEY sem chamar a Riot', async () => {
  const riot = new FakeRiot();
  const { c } = client(riot, new FakeClock(), '');
  await assert.rejects(c.get(HOST, '/x'), (e: AppError) => e.code === 'MISSING_API_KEY' && e.status === 503);
  assert.equal(riot.calls.length, 0);
});

test('chave inválida ou expirada (401/403): RIOT_AUTH, sem novas tentativas', async () => {
  for (const status of [401, 403]) {
    const riot = new FakeRiot();
    riot.intercept = () => ({ status, body: { status: { message: 'Forbidden' } } });
    const { c } = client(riot);
    await assert.rejects(c.get(HOST, '/x'), (e: AppError) => e.code === 'RIOT_AUTH');
    assert.equal(riot.calls.length, 1);
  }
});

test('HTTP 429: espera o Retry-After informado e repete', async () => {
  const riot = new FakeRiot();
  let n = 0;
  riot.intercept = () => (++n === 1 ? { status: 429, headers: { 'retry-after': '3', 'x-rate-limit-type': 'application' } } : undefined);
  const { c, clock } = client(riot);
  const t0 = clock.now();
  const result = await c.get<unknown[]>(HOST, '/lol/league/v4/entries/by-puuid/abc');
  assert.ok(Array.isArray(result));
  assert.equal(riot.calls.length, 2);
  assert.ok(clock.now() - t0 >= 3000, 'aguardou ao menos os 3 s do Retry-After');
});

test('HTTP 429 com espera maior que a aceita: RATE_LIMITED com o tempo de espera, sem insistir', async () => {
  const riot = new FakeRiot();
  riot.intercept = () => ({ status: 429, headers: { 'retry-after': '60' } });
  const { c, limiter } = client(riot);
  await assert.rejects(
    c.get(HOST, '/x', { maxWaitMs: 5000 }),
    (e: AppError) => e.code === 'RATE_LIMITED' && e.details.retryAfterSec === 60 && e.status === 429,
  );
  assert.equal(riot.calls.length, 1);
  // Enquanto durar o bloqueio, novas chamadas falham na hora, sem ir à Riot.
  await assert.rejects(c.get(HOST, '/y', { maxWaitMs: 5000 }), (e: AppError) => e.code === 'RATE_LIMITED');
  assert.equal(riot.calls.length, 1);
  assert.ok(limiter.waitTime(HOST) > 50_000);
});

test('HTTP 429 repetido: desiste após o número máximo de tentativas (sem loop infinito)', async () => {
  const riot = new FakeRiot();
  riot.intercept = () => ({ status: 429, headers: { 'retry-after': '1' } });
  const { c } = client(riot);
  await assert.rejects(c.get(HOST, '/x'), (e: AppError) => e.code === 'RATE_LIMITED');
  assert.equal(riot.calls.length, 4); // 1 tentativa + 3 repetições
});

test('falha temporária (5xx): repete com espera crescente e se recupera', async () => {
  const riot = new FakeRiot();
  let n = 0;
  riot.intercept = () => (++n <= 2 ? { status: 503 } : undefined);
  const { c, clock } = client(riot);
  await c.get(HOST, '/lol/league/v4/entries/by-puuid/abc');
  assert.equal(riot.calls.length, 3);
  assert.deepEqual(clock.slept.slice(0, 2), [400, 800]);
});

test('falha de rede persistente: RIOT_UNAVAILABLE após tentativas limitadas', async () => {
  const riot = new FakeRiot();
  let attempts = 0;
  const limiter = new RateLimiter([{ max: 20, windowMs: 1000 }], new FakeClock());
  const c = new RiotClient({
    apiKey: KEY,
    limiter,
    clock: new FakeClock(),
    fetchImpl: async () => {
      attempts++;
      throw new Error('ECONNRESET');
    },
  });
  await assert.rejects(c.get(HOST, '/x'), (e: AppError) => e.code === 'RIOT_UNAVAILABLE' && e.status === 503);
  assert.equal(attempts, 4);
  assert.equal(riot.calls.length, 0);
});

test('rate limiter: nunca passa de 20 requisições por segundo nem de 100 a cada 2 minutos', async () => {
  const clock = new FakeClock();
  const limiter = new RateLimiter([{ max: 20, windowMs: 1000 }, { max: 100, windowMs: 120_000 }], clock);
  const stamps: number[] = [];
  for (let i = 0; i < 230; i++) {
    await limiter.acquire(HOST, Infinity);
    stamps.push(clock.now());
  }
  for (let i = 0; i < stamps.length; i++) {
    const inSecond = stamps.filter((t) => t <= stamps[i] && t > stamps[i] - 1000).length;
    const inTwoMin = stamps.filter((t) => t <= stamps[i] && t > stamps[i] - 120_000).length;
    assert.ok(inSecond <= 20, `janela de 1 s com ${inSecond}`);
    assert.ok(inTwoMin <= 100, `janela de 120 s com ${inTwoMin}`);
  }
  assert.ok(stamps.at(-1)! - stamps[0] >= 240_000, '230 requisições exigem ao menos duas janelas de espera');
});

test('rate limiter: baldes independentes por host e limites atualizados pelo cabeçalho da Riot', async () => {
  const clock = new FakeClock();
  const limiter = new RateLimiter([{ max: 1, windowMs: 10_000 }], clock);
  await limiter.acquire('a', 0);
  await limiter.acquire('b', 0); // outro host não é afetado
  await assert.rejects(limiter.acquire('a', 100), RateLimitExceededError);
  limiter.updateRules([{ max: 5, windowMs: 10_000 }]);
  await limiter.acquire('a', 0);
});
