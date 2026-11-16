/**
 * Modo pessoal (PERSONAL_MODE=1): uso sem conta, só para pedidos sem token
 * vindos da própria máquina ou da rede local. Desligado por padrão.
 */
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';

import { createHttpHandler, httpDepsFrom } from '../src/http/server.ts';
import { setup, signUp } from './helpers.ts';

function client(handler: ReturnType<typeof createHttpHandler>, ip: string) {
  return async (method: string, url: string, opts: { body?: unknown; token?: string } = {}) => {
    let status = 0;
    let text = '';
    const req = Object.assign(Readable.from(opts.body === undefined ? [] : [JSON.stringify(opts.body)]), {
      url,
      method,
      headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
      socket: { remoteAddress: ip },
    });
    const res = { setHeader: () => undefined, writeHead: (s: number) => (status = s), end: (b?: string) => (text = b ?? '') };
    await handler(req as never, res as never);
    return { status, json: text ? JSON.parse(text) : null };
  };
}

test('modo pessoal desligado (padrão): sem token, nada de dados', async () => {
  const ctx = setup();
  const local = client(createHttpHandler(httpDepsFrom(ctx.app)), '127.0.0.1');
  assert.equal((await local('GET', '/v1/me')).status, 401);
  assert.equal((await local('GET', '/health')).json.personalMode, false);
});

test('modo pessoal: rede local entra sem conta como um único usuário; internet continua exigindo login', async () => {
  const ctx = setup();
  const handler = createHttpHandler({ ...httpDepsFrom(ctx.app), personalMode: true });
  const pc = client(handler, '127.0.0.1');
  const phone = client(handler, '::ffff:192.168.0.23');
  const internet = client(handler, '203.0.113.5');

  assert.equal((await pc('GET', '/health')).json.personalMode, true);
  const me = (await pc('GET', '/v1/me')).json;
  assert.equal(me.user.username, 'local');
  assert.equal(me.user.emailVerified, true, 'pode vincular a conta Riot sem confirmar e-mail');
  assert.equal((await phone('GET', '/v1/me')).json.user.id, me.user.id, 'mesmo usuário no celular da mesma rede');

  // Dados pessoais funcionam e ficam no usuário local.
  await pc('POST', '/v1/me/matchups', { body: { championId: 'Zoe', opponentId: 'Ahri', difficulty: 'facil', note: 'local' } });
  assert.equal((await phone('GET', '/v1/me/matchups')).json.notes.length, 1);

  // Da internet, nada sem token.
  assert.equal((await internet('GET', '/v1/me')).status, 401);
  assert.equal((await internet('GET', '/v1/me/matchups')).status, 401);

  // Quem tem conta continua vendo só os próprios dados, mesmo na rede local.
  const ana = await signUp(ctx, 'Ana');
  assert.deepEqual((await pc('GET', '/v1/me/matchups', { token: ana.tokens.accessToken })).json.notes, []);
  assert.equal((await pc('GET', '/v1/me', { token: 'token-invalido' })).status, 401, 'token inválido não cai no usuário local');

  // Ninguém consegue entrar como o usuário local pelo login.
  const login = await internet('POST', '/v1/auth/login', { body: { email: 'local@lolinsight.invalid', password: 'qualquer-senha-123' } });
  assert.equal(login.status, 401);
});
