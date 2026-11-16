/**
 * Caderno de matchups: anotações por usuário, validação, isolamento entre
 * usuários e exclusão junto com a conta.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { AppError } from '../src/errors.ts';
import { NOTE_MAX_CHARS } from '../src/notes/matchupNotes.ts';
import { httpClient, setup, signUp } from './helpers.ts';

test('caderno: criar, atualizar, listar e apagar anotações', async () => {
  const ctx = setup();
  const a = await signUp(ctx, 'Ana');
  const svc = ctx.app.matchups;
  const n1 = svc.save(a.userId, { championId: 'Zoe', opponentId: 'Ahri', difficulty: 'dificil', note: '  Guardar a bolha para depois do encanto.  ' });
  assert.equal(n1.note, 'Guardar a bolha para depois do encanto.');
  ctx.clock.t += 1000;
  svc.save(a.userId, { championId: 'Zoe', opponentId: 'Syndra', difficulty: 'equilibrado', note: '' });
  ctx.clock.t += 1000;
  const upd = svc.save(a.userId, { championId: 'Zoe', opponentId: 'Ahri', difficulty: 'equilibrado', note: 'Melhorou com Zhonya cedo.' });
  const list = svc.list(a.userId);
  assert.deepEqual(list.map((n) => [n.opponentId, n.difficulty]), [['Ahri', 'equilibrado'], ['Syndra', 'equilibrado']]);
  assert.equal(list[0].updatedAt, upd.updatedAt);
  svc.remove(a.userId, 'Zoe', 'Syndra');
  assert.equal(svc.list(a.userId).length, 1);
  assert.throws(() => svc.remove(a.userId, 'Zoe', 'Syndra'), (e: AppError) => e.code === 'NOT_FOUND');
});

test('caderno: validação dos campos', async () => {
  const ctx = setup();
  const a = await signUp(ctx, 'Ana');
  const bad = (body: Record<string, unknown>) => assert.throws(() => ctx.app.matchups.save(a.userId, body), (e: AppError) => e.code === 'INVALID_PARAMS');
  bad({ championId: 'Zoe', opponentId: 'Zoe', difficulty: 'facil', note: '' });
  bad({ championId: 'Zoe; DROP TABLE', opponentId: 'Ahri', difficulty: 'facil', note: '' });
  bad({ championId: 'Zoe', opponentId: 'Ahri', difficulty: 'impossivel', note: '' });
  bad({ championId: 'Zoe', opponentId: 'Ahri', difficulty: 'facil', note: 'x'.repeat(NOTE_MAX_CHARS + 1) });
});

test('caderno: um usuário nunca vê nem apaga as anotações de outro; a exclusão da conta leva as anotações', async () => {
  const ctx = setup();
  const a = await signUp(ctx, 'Ana');
  const b = await signUp(ctx, 'Bia', { ip: '10.0.0.2' });
  const call = httpClient(ctx.app);
  const A = { token: a.tokens.accessToken };
  const B = { token: b.tokens.accessToken };
  const saved = await call('POST', '/v1/me/matchups', { ...A, body: { championId: 'Zoe', opponentId: 'Ahri', difficulty: 'dificil', note: 'Nota da Ana' } });
  assert.equal(saved.status, 200);
  assert.equal(saved.json.note.note, 'Nota da Ana');
  assert.deepEqual((await call('GET', '/v1/me/matchups', B)).json.notes, []);
  // A Bia tenta apagar a anotação da Ana: resposta igual à de uma anotação inexistente.
  assert.equal((await call('DELETE', '/v1/me/matchups/Zoe/Ahri', B)).json.error.code, 'NOT_FOUND');
  assert.equal((await call('GET', '/v1/me/matchups', A)).json.notes.length, 1);
  // Mesmo confronto, cada usuário com a sua anotação.
  await call('POST', '/v1/me/matchups', { ...B, body: { championId: 'Zoe', opponentId: 'Ahri', difficulty: 'facil', note: 'Nota da Bia' } });
  assert.equal((await call('GET', '/v1/me/matchups', A)).json.notes[0].note, 'Nota da Ana');
  assert.equal((await call('GET', '/v1/me/matchups', B)).json.notes[0].note, 'Nota da Bia');
  await ctx.app.auth.deleteAccount(a.auth, a.password);
  assert.equal((ctx.app.db.prepare('SELECT COUNT(*) AS n FROM matchup_notes WHERE user_id = ?').get(a.userId) as { n: number }).n, 0);
  assert.equal(ctx.app.matchups.list(b.userId).length, 1);
});
