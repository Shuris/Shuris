import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { ACCESS_TTL_MS, REFRESH_TTL_MS } from '../src/auth/authService.ts';
import { TokenCipher } from '../src/auth/crypto.ts';
import { hashPassword, needsRehash, STANDARD_PARAMS, TEST_PARAMS, verifyPassword } from '../src/auth/password.ts';
import { MIGRATIONS, openDatabase, SCHEMA_VERSION } from '../src/db/database.ts';
import { AppError } from '../src/errors.ts';
import { CTX, httpClient, setup, signUp, tenMatches } from './helpers.ts';

const code = (e: unknown) => (e as AppError).code;

// ---------------------------------------------------------------------------------
// Cadastro e senhas
// ---------------------------------------------------------------------------------

test('dois usuários criando contas: IDs únicos e permanentes, senhas com hash e sal próprios', async () => {
  const ctx = setup();
  const a = await signUp(ctx, 'Gregory', { verify: false });
  const b = await signUp(ctx, 'Yuna', { verify: false });
  assert.match(a.userId, /^usr_[0-9a-f]{24}$/);
  assert.notEqual(a.userId, b.userId);
  const rows = ctx.app.db.prepare('SELECT id, email, password_hash FROM users ORDER BY created_at').all() as Array<{ id: string; email: string; password_hash: string }>;
  assert.equal(rows.length, 2);
  for (const r of rows) {
    assert.match(r.password_hash, /^scrypt\$\d+\$\d+\$\d+\$[\w-]+\$[\w-]+$/);
    assert.ok(!r.password_hash.includes('senha-forte'));
  }
  // Mesma senha, hashes diferentes (sal aleatório).
  const h1 = await hashPassword('mesma-senha-123', TEST_PARAMS);
  const h2 = await hashPassword('mesma-senha-123', TEST_PARAMS);
  assert.notEqual(h1, h2);
  assert.ok((await verifyPassword('mesma-senha-123', h1)) && !(await verifyPassword('mesma-senha-124', h1)));
  assert.equal(await verifyPassword('qualquer', 'texto-que-nao-e-hash'), false);
  // Cadastro já entra com sessão e e-mail não verificado.
  assert.equal(a.auth.user.emailVerifiedAt, null);
  assert.equal(ctx.mailer.sent.filter((m) => m.kind === 'verify-email').length, 2);
});

test('validação no cadastro: e-mail, usuário, senha fraca e duplicidade sem diferenciar maiúsculas', async () => {
  const ctx = setup();
  await signUp(ctx, 'Gregory', { verify: false });
  const reg = (input: Record<string, unknown>) => ctx.app.auth.register(input, CTX);
  await assert.rejects(reg({ username: 'novo', email: 'GREGORY@exemplo.com', password: 'outra-senha-boa' }), (e) => code(e) === 'EMAIL_TAKEN');
  await assert.rejects(reg({ username: 'GREGORY', email: 'novo@exemplo.com', password: 'outra-senha-boa' }), (e) => code(e) === 'USERNAME_TAKEN');
  await assert.rejects(reg({ username: 'novo', email: 'sem-arroba', password: 'outra-senha-boa' }), (e) => code(e) === 'INVALID_EMAIL');
  await assert.rejects(reg({ username: 'a b', email: 'novo@exemplo.com', password: 'outra-senha-boa' }), (e) => code(e) === 'INVALID_USERNAME');
  for (const password of ['curta', '12345678', 'aaaaaaaaaa', 'novo@exemplo.com', 'x'.repeat(129)]) {
    await assert.rejects(reg({ username: 'novo', email: 'novo@exemplo.com', password }), (e) => code(e) === 'WEAK_PASSWORD', password);
  }
});

test('hash com parâmetros antigos é atualizado no login', async () => {
  const ctx = setup();
  const u = await signUp(ctx, 'Gregory');
  const weak = await hashPassword(u.password, { logN: 8, r: 8, p: 1 });
  ctx.app.authRepo.setPassword(u.userId, weak, 0, false);
  assert.ok(needsRehash(weak, TEST_PARAMS));
  await ctx.app.auth.login({ email: u.email, password: u.password }, CTX);
  const stored = ctx.app.authRepo.userById(u.userId)!.passwordHash;
  assert.notEqual(stored, weak);
  assert.ok(!needsRehash(stored, TEST_PARAMS));
  assert.ok(needsRehash(stored, STANDARD_PARAMS), 'os parâmetros de produção são mais fortes que os de teste');
});

// ---------------------------------------------------------------------------------
// Login, logout e sessões
// ---------------------------------------------------------------------------------

test('login e logout: credenciais erradas têm mensagem genérica; logout invalida o token', async () => {
  const ctx = setup();
  const u = await signUp(ctx, 'Gregory');
  const ok = await ctx.app.auth.login({ email: '  GREGORY@exemplo.com ', password: u.password }, CTX);
  assert.equal(ok.user.username, 'Gregory');

  const wrong = await ctx.app.auth.login({ email: u.email, password: 'senha-errada-123' }, CTX).catch((e) => e);
  const unknown = await ctx.app.auth.login({ email: 'ninguem@exemplo.com', password: 'senha-errada-123' }, CTX).catch((e) => e);
  assert.deepEqual([wrong.code, wrong.message], ['INVALID_CREDENTIALS', 'E-mail ou senha incorretos.']);
  assert.deepEqual([unknown.code, unknown.message], [wrong.code, wrong.message], 'não revela se o e-mail existe');

  const auth = ctx.app.auth.authenticate(`Bearer ${ok.session.accessToken}`);
  ctx.app.auth.logout(auth);
  assert.throws(() => ctx.app.auth.authenticate(`Bearer ${ok.session.accessToken}`), (e) => code(e) === 'AUTH_REQUIRED');
  assert.throws(() => ctx.app.auth.refresh(ok.session.refreshToken, CTX), (e) => code(e) === 'AUTH_REQUIRED');
  assert.throws(() => ctx.app.auth.authenticate(undefined), (e) => code(e) === 'AUTH_REQUIRED');
  assert.throws(() => ctx.app.auth.authenticate('Bearer token-inventado'), (e) => code(e) === 'AUTH_REQUIRED');
});

test('proteção contra tentativas excessivas: bloqueia após 5 erros, mesmo com a senha certa, e libera depois', async () => {
  const ctx = setup();
  const u = await signUp(ctx, 'Gregory');
  for (let i = 0; i < 5; i++) await assert.rejects(ctx.app.auth.login({ email: u.email, password: `errada-${i}-xx` }, CTX), (e) => code(e) === 'INVALID_CREDENTIALS');
  const locked = await ctx.app.auth.login({ email: u.email, password: u.password }, CTX).catch((e) => e);
  assert.equal(locked.code, 'TOO_MANY_ATTEMPTS');
  assert.equal(locked.status, 429);
  assert.ok(locked.details.retryAfterSec > 0 && locked.details.retryAfterSec <= 900);
  // E-mail inexistente também é limitado (não revela quais contas existem).
  for (let i = 0; i < 5; i++) await ctx.app.auth.login({ email: 'fantasma@exemplo.com', password: 'xxxxxxxxx' }, CTX).catch(() => null);
  assert.equal(code(await ctx.app.auth.login({ email: 'fantasma@exemplo.com', password: 'xxxxxxxxx' }, CTX).catch((e) => e)), 'TOO_MANY_ATTEMPTS');

  ctx.clock.t += 16 * 60_000;
  assert.equal((await ctx.app.auth.login({ email: u.email, password: u.password }, CTX)).user.id, u.userId);
});

test('limite por rede: muitas tentativas a partir do mesmo IP bloqueiam todas as contas desse IP', async () => {
  const ctx = setup();
  for (let i = 0; i < 30; i++) await ctx.app.auth.login({ email: `alvo${i}@exemplo.com`, password: 'xxxxxxxxx' }, { ...CTX, ip: '203.0.113.5' }).catch(() => null);
  assert.equal(code(await ctx.app.auth.login({ email: 'outro@exemplo.com', password: 'xxxxxxxxx' }, { ...CTX, ip: '203.0.113.5' }).catch((e) => e)), 'TOO_MANY_ATTEMPTS');
  assert.equal(code(await ctx.app.auth.login({ email: 'outro@exemplo.com', password: 'xxxxxxxxx' }, { ...CTX, ip: '203.0.113.6' }).catch((e) => e)), 'INVALID_CREDENTIALS');
});

test('expiração e renovação: acesso expira em 15 min, renovação troca o par e reuso derruba a sessão', async () => {
  const ctx = setup();
  const u = await signUp(ctx, 'Gregory');
  const first = u.tokens;
  ctx.clock.t += ACCESS_TTL_MS + 1000;
  assert.throws(() => ctx.app.auth.authenticate(`Bearer ${first.accessToken}`), (e) => code(e) === 'TOKEN_EXPIRED');

  const second = ctx.app.auth.refresh(first.refreshToken, CTX).session;
  assert.notEqual(second.accessToken, first.accessToken);
  assert.notEqual(second.refreshToken, first.refreshToken);
  assert.equal(ctx.app.auth.authenticate(`Bearer ${second.accessToken}`).user.id, u.userId);

  // Alguém reusa o token de renovação antigo: a sessão inteira é encerrada.
  assert.throws(() => ctx.app.auth.refresh(first.refreshToken, CTX), (e) => code(e) === 'AUTH_REQUIRED');
  assert.throws(() => ctx.app.auth.authenticate(`Bearer ${second.accessToken}`), (e) => code(e) === 'AUTH_REQUIRED');
  assert.throws(() => ctx.app.auth.refresh(second.refreshToken, CTX), (e) => code(e) === 'AUTH_REQUIRED');

  // Renovação também expira (30 dias).
  const login = await ctx.app.auth.login({ email: u.email, password: u.password }, CTX);
  ctx.clock.t += REFRESH_TTL_MS + 1000;
  assert.throws(() => ctx.app.auth.refresh(login.session.refreshToken, CTX), (e) => code(e) === 'AUTH_REQUIRED');
});

test('tokens e códigos ficam no banco somente como hash', async () => {
  const ctx = setup();
  const u = await signUp(ctx, 'Gregory', { verify: false });
  const dump = JSON.stringify([
    ctx.app.db.prepare('SELECT * FROM user_sessions').all(),
    ctx.app.db.prepare('SELECT * FROM email_verification_tokens').all(),
  ]);
  assert.ok(!dump.includes(u.tokens.accessToken) && !dump.includes(u.tokens.refreshToken));
  assert.ok(!dump.includes(`"${ctx.mailer.last(u.email, 'verify-email')!.code}"`));
});

test('gerenciamento de sessões: listar, encerrar uma e encerrar as outras', async () => {
  const ctx = setup();
  const u = await signUp(ctx, 'Gregory');
  await ctx.app.auth.login({ email: u.email, password: u.password }, { ip: '10.0.0.2', client: 'Android · Expo Go' });
  const third = await ctx.app.auth.login({ email: u.email, password: u.password }, { ip: '10.0.0.3', client: 'Web · Chrome' });
  const list = ctx.app.auth.sessions(u.auth);
  assert.equal(list.length, 3);
  assert.equal(list.filter((s) => s.current).length, 1);
  assert.ok(list.some((s) => s.client === 'Android · Expo Go'));

  const thirdId = ctx.app.auth.authenticate(`Bearer ${third.session.accessToken}`).sessionId;
  ctx.app.auth.revokeSession(u.auth, thirdId);
  assert.throws(() => ctx.app.auth.authenticate(`Bearer ${third.session.accessToken}`), (e) => code(e) === 'AUTH_REQUIRED');
  assert.equal(ctx.app.auth.revokeOtherSessions(u.auth), 1);
  assert.deepEqual(ctx.app.auth.sessions(u.auth).map((s) => s.current), [true]);
});

// ---------------------------------------------------------------------------------
// E-mail e senha
// ---------------------------------------------------------------------------------

test('validação de e-mail: código de 6 dígitos, no máximo 5 tentativas, reenvio limitado', async () => {
  const ctx = setup();
  const u = await signUp(ctx, 'Gregory', { verify: false });
  const right = ctx.mailer.last(u.email, 'verify-email')!.code;
  assert.match(right, /^\d{6}$/);
  const wrong = right === '000000' ? '111111' : '000000';
  assert.throws(() => ctx.app.auth.verifyEmail(u.auth, wrong), (e) => code(e) === 'INVALID_CODE' && /Restam 4/.test((e as Error).message));
  for (let i = 0; i < 4; i++) assert.throws(() => ctx.app.auth.verifyEmail(u.auth, wrong));
  assert.throws(() => ctx.app.auth.verifyEmail(u.auth, right), (e) => code(e) === 'INVALID_CODE', 'código queimado após 5 erros');

  await ctx.app.auth.resendVerification(u.auth);
  const fresh = ctx.mailer.last(u.email, 'verify-email')!.code;
  assert.equal(ctx.app.auth.verifyEmail(u.auth, fresh).emailVerified, true);
  await ctx.app.auth.resendVerification(ctx.app.auth.authenticate(`Bearer ${u.tokens.accessToken}`)); // já verificado: nada acontece

  const v = await signUp(ctx, 'Yuna', { verify: false });
  await ctx.app.auth.resendVerification(v.auth);
  await ctx.app.auth.resendVerification(v.auth);
  await ctx.app.auth.resendVerification(v.auth);
  await assert.rejects(ctx.app.auth.resendVerification(v.auth), (e) => code(e) === 'TOO_MANY_ATTEMPTS');
});

test('recuperação de senha: resposta igual para qualquer e-mail, código de uso único, sessões encerradas', async () => {
  const ctx = setup();
  const u = await signUp(ctx, 'Gregory', { verify: false });
  const other = await ctx.app.auth.login({ email: u.email, password: u.password }, CTX);

  await ctx.app.auth.forgotPassword('ninguem@exemplo.com', CTX);
  assert.equal(ctx.mailer.sent.filter((m) => m.kind === 'password-reset').length, 0, 'e-mail inexistente: nenhum envio, mesma resposta');
  await ctx.app.auth.forgotPassword(u.email.toUpperCase(), CTX);
  const resetCode = ctx.mailer.last(u.email, 'password-reset')!.code;

  const reset = (c: string, password = 'nova-senha-segura') => ctx.app.auth.resetPassword({ email: u.email, code: c, password }, CTX);
  await assert.rejects(reset(resetCode === '000000' ? '111111' : '000000'), (e) => code(e) === 'INVALID_CODE');
  await assert.rejects(reset(resetCode, '123'), (e) => code(e) === 'WEAK_PASSWORD');
  await reset(resetCode);
  await assert.rejects(reset(resetCode), (e) => code(e) === 'INVALID_CODE', 'código de uso único');

  await assert.rejects(ctx.app.auth.login({ email: u.email, password: u.password }, CTX), (e) => code(e) === 'INVALID_CREDENTIALS');
  assert.equal((await ctx.app.auth.login({ email: u.email, password: 'nova-senha-segura' }, CTX)).user.emailVerified, true, 'redefinir comprova o e-mail');
  assert.throws(() => ctx.app.auth.authenticate(`Bearer ${u.tokens.accessToken}`), (e) => code(e) === 'AUTH_REQUIRED');
  assert.throws(() => ctx.app.auth.authenticate(`Bearer ${other.session.accessToken}`), (e) => code(e) === 'AUTH_REQUIRED');

  // Código expira em 15 minutos.
  await ctx.app.auth.forgotPassword(u.email, CTX);
  const late = ctx.mailer.last(u.email, 'password-reset')!.code;
  ctx.clock.t += 16 * 60_000;
  await assert.rejects(reset(late, 'mais-uma-senha-boa'), (e) => code(e) === 'INVALID_CODE');
});

test('troca de senha: exige a senha atual e encerra as outras sessões, mantendo a atual', async () => {
  const ctx = setup();
  const u = await signUp(ctx, 'Gregory');
  const other = await ctx.app.auth.login({ email: u.email, password: u.password }, CTX);
  await assert.rejects(ctx.app.auth.changePassword(u.auth, { currentPassword: 'errada-123', newPassword: 'nova-senha-boa' }), (e) => code(e) === 'INVALID_CREDENTIALS');
  await ctx.app.auth.changePassword(u.auth, { currentPassword: u.password, newPassword: 'nova-senha-boa' });
  assert.equal(ctx.app.auth.authenticate(`Bearer ${u.tokens.accessToken}`).user.id, u.userId);
  assert.throws(() => ctx.app.auth.authenticate(`Bearer ${other.session.accessToken}`), (e) => code(e) === 'AUTH_REQUIRED');
});

test('exclusão da conta: exige a senha e apaga todos os dados pessoais, preservando dados públicos', async () => {
  const ctx = setup();
  ctx.riot.matches = tenMatches();
  const u = await signUp(ctx, 'Gregory');
  await ctx.app.riotLinks.link(u.auth, { gameName: 'Gregory', tagLine: 'BR1', region: 'BR' });
  await ctx.app.sync.idle();
  await ctx.app.academy.report(u.userId, 10);
  ctx.app.db.prepare("INSERT INTO challenge_progress (user_id, challenge_id, status, started_at, updated_at) VALUES (?, 'c1', 'active', 1, 1)").run(u.userId);
  ctx.app.db.prepare("INSERT INTO replay_analyses (id, user_id, match_id, puuid, created_at, updated_at) VALUES ('rpl_1', ?, 'BR1_1', 'p', 1, 1)").run(u.userId);
  assert.ok(ctx.app.authRepo.personalRowCount(u.userId) > 5);

  await assert.rejects(ctx.app.auth.deleteAccount(u.auth, 'senha-errada'), (e) => code(e) === 'INVALID_CREDENTIALS');
  await ctx.app.auth.deleteAccount(u.auth, u.password);
  assert.equal(ctx.app.authRepo.userById(u.userId), null);
  assert.equal(ctx.app.authRepo.personalRowCount(u.userId), 0);
  assert.throws(() => ctx.app.auth.authenticate(`Bearer ${u.tokens.accessToken}`), (e) => code(e) === 'AUTH_REQUIRED');
  assert.ok((ctx.app.db.prepare('SELECT COUNT(*) AS n FROM matches').get() as { n: number }).n > 0, 'partidas públicas permanecem em cache');
  // O e-mail fica livre para um novo cadastro.
  assert.ok((await ctx.app.auth.register({ username: 'Gregory', email: u.email, password: 'senha-totalmente-nova' }, CTX)).user.id !== u.userId);
});

// ---------------------------------------------------------------------------------
// Conta Riot e configurações
// ---------------------------------------------------------------------------------

test('vinculação Riot: exige e-mail confirmado, fica "não verificada" e gerencia a conta principal', async () => {
  const ctx = setup();
  ctx.riot.matches = tenMatches();
  const unverified = await signUp(ctx, 'Novato', { verify: false });
  await assert.rejects(ctx.app.riotLinks.link(unverified.auth, { gameName: 'Gregory', tagLine: 'BR1', region: 'BR' }), (e) => code(e) === 'EMAIL_NOT_VERIFIED');

  const u = await signUp(ctx, 'Gregory');
  await assert.rejects(ctx.app.riotLinks.link(u.auth, { gameName: 'Gregory', tagLine: 'BR1', region: 'XX' }), (e) => code(e) === 'INVALID_REGION');
  await assert.rejects(ctx.app.riotLinks.link(u.auth, { gameName: 'Ninguem', tagLine: 'BR1', region: 'BR' }), (e) => code(e) === 'PLAYER_NOT_FOUND');
  const first = await ctx.app.riotLinks.link(u.auth, { gameName: 'gregory', tagLine: 'br1', region: 'br' });
  assert.equal(first.verificationStatus, 'unverified');
  assert.equal(first.verifiedAt, null);
  assert.equal(first.isPrimary, true);
  assert.equal(first.gameName, 'Gregory', 'grafia oficial devolvida pela Riot');
  await assert.rejects(ctx.app.riotLinks.link(u.auth, { gameName: 'Gregory', tagLine: 'BR1', region: 'BR' }), (e) => code(e) === 'RIOT_ACCOUNT_LINKED');

  ctx.riot.account = { puuid: 'puuid-segunda-conta-0000000000000', gameName: 'Smurf', tagLine: 'BR1' };
  const second = await ctx.app.riotLinks.link(u.auth, { gameName: 'Smurf', tagLine: 'BR1', region: 'BR' });
  assert.equal(second.isPrimary, false);
  assert.equal(ctx.app.riotLinks.setPrimary(u.auth, second.id).find((a) => a.isPrimary)!.id, second.id);
  assert.deepEqual(ctx.app.riotLinks.unlink(u.auth, second.id).map((a) => [a.id, a.isPrimary]), [[first.id, true]], 'ao remover a principal, a restante assume');
});

test('configurações pessoais: validadas e separadas por usuário', async () => {
  const ctx = setup();
  const a = await signUp(ctx, 'Gregory');
  const b = await signUp(ctx, 'Yuna');
  const call = httpClient(ctx.app);
  const saved = await call('POST', '/v1/me/settings', { token: a.tokens.accessToken, body: { matchCount: 50, preferredRegion: 'KR' } });
  assert.deepEqual([saved.json.settings.matchCount, saved.json.settings.preferredRegion], [50, 'KR']);
  assert.equal((await call('POST', '/v1/me/settings', { token: a.tokens.accessToken, body: { matchCount: 7 } })).json.error.code, 'INVALID_PARAMS');
  assert.equal((await call('POST', '/v1/me/settings', { token: a.tokens.accessToken, body: { preferredRegion: 'XX' } })).json.error.code, 'INVALID_REGION');
  assert.deepEqual((await call('GET', '/v1/me', { token: b.tokens.accessToken })).json.settings.matchCount, 20);
});

// ---------------------------------------------------------------------------------
// Isolamento e rotas privadas (HTTP)
// ---------------------------------------------------------------------------------

test('rotas privadas: todas exigem token válido', async () => {
  const ctx = setup();
  const call = httpClient(ctx.app);
  const routes: Array<[string, string]> = [
    ['GET', '/v1/me'], ['GET', '/v1/me/sessions'], ['POST', '/v1/me/sessions/revoke-others'], ['DELETE', '/v1/me/sessions/ses_x'],
    ['GET', '/v1/me/riot-accounts'], ['POST', '/v1/me/riot-accounts'], ['DELETE', '/v1/me/riot-accounts/ria_x'], ['POST', '/v1/me/password'],
    ['POST', '/v1/me/delete'], ['POST', '/v1/me/settings'], ['POST', '/v1/me/email/verify'], ['GET', '/v1/me/coach?count=20'],
    ['POST', '/v1/me/coach/attempts?count=20'], ['GET', '/v1/me/matchups'], ['POST', '/v1/me/matchups'], ['DELETE', '/v1/me/matchups/Zoe/Ahri'], ['POST', '/v1/auth/logout'], ['GET', '/v1/accounts/BR/Gregory/BR1'], ['GET', '/v1/matches/BR1_123456/details?puuid=x'],
  ];
  for (const [method, url] of routes) {
    const res = await call(method, url, { body: {} });
    assert.equal(res.status, 401, `${method} ${url}`);
    const forged = await call(method, url, { body: {}, token: 'token-forjado-qualquer' });
    assert.equal(forged.status, 401, `${method} ${url} com token forjado`);
  }
});

test('isolamento: um usuário não vê nem altera dados de outro', async () => {
  const ctx = setup();
  ctx.riot.matches = tenMatches();
  const a = await signUp(ctx, 'Gregory');
  const b = await signUp(ctx, 'Yuna');
  const call = httpClient(ctx.app);
  const A = { token: a.tokens.accessToken };
  const B = { token: b.tokens.accessToken };

  const linked = await call('POST', '/v1/me/riot-accounts', { ...A, body: { gameName: 'Gregory', tagLine: 'BR1', region: 'BR' } });
  assert.equal(linked.status, 200);
  const riotId = linked.json.riotAccount.id;
  const aSession = (await call('GET', '/v1/me/sessions', A)).json.sessions[0].id;

  const meB = await call('GET', '/v1/me', B);
  assert.equal(meB.json.user.username, 'Yuna');
  assert.deepEqual(meB.json.riotAccounts, []);
  assert.ok(!JSON.stringify(meB.json).includes(a.email));
  assert.equal(meB.json.user.passwordHash, undefined);

  // B tenta mexer no que é de A: tudo responde como inexistente.
  assert.equal((await call('DELETE', `/v1/me/sessions/${aSession}`, B)).status, 404);
  assert.equal((await call('DELETE', `/v1/me/riot-accounts/${riotId}`, B)).status, 404);
  assert.equal((await call('POST', `/v1/me/riot-accounts/${riotId}/primary`, B)).status, 404);
  assert.equal((await call('GET', '/v1/me/coach?count=10', B)).json.error.code, 'NO_RIOT_ACCOUNT');
  // Nada foi alterado para A.
  assert.equal((await call('GET', '/v1/me', A)).json.riotAccounts.length, 1);
  assert.equal((await call('GET', '/v1/me/sessions', A)).json.sessions.length, 1);
  // O corpo da requisição não consegue trocar o usuário.
  await call('POST', '/v1/me/settings', { ...B, body: { userId: a.userId, matchCount: 100 } });
  assert.equal(ctx.app.authRepo.settings(a.userId).matchCount, 20);
});

test('HTTP de autenticação: cadastro, login, renovação, recuperação e exclusão', async () => {
  const ctx = setup();
  const call = httpClient(ctx.app);
  const reg = await call('POST', '/v1/auth/register', { body: { username: 'Gregory', email: 'g@exemplo.com', password: 'senha-forte-123' } });
  assert.equal(reg.status, 200);
  assert.equal(reg.json.user.emailVerified, false);
  assert.ok(reg.json.session.accessToken && reg.json.session.refreshToken);
  assert.equal((await call('POST', '/v1/auth/register', { body: { username: 'Outro', email: 'g@exemplo.com', password: 'senha-forte-123' } })).status, 409);

  const token = reg.json.session.accessToken;
  const verify = await call('POST', '/v1/me/email/verify', { token, body: { code: ctx.mailer.last('g@exemplo.com', 'verify-email')!.code } });
  assert.equal(verify.json.user.emailVerified, true);

  assert.equal((await call('POST', '/v1/auth/login', { body: { email: 'g@exemplo.com', password: 'errada-999' } })).status, 401);
  const login = await call('POST', '/v1/auth/login', { body: { email: 'g@exemplo.com', password: 'senha-forte-123' } });
  const refreshed = await call('POST', '/v1/auth/refresh', { body: { refreshToken: login.json.session.refreshToken } });
  assert.equal(refreshed.status, 200);
  assert.notEqual(refreshed.json.session.refreshToken, login.json.session.refreshToken);

  const forgot = await call('POST', '/v1/auth/password/forgot', { body: { email: 'g@exemplo.com' } });
  const forgotUnknown = await call('POST', '/v1/auth/password/forgot', { body: { email: 'x@exemplo.com' } });
  assert.deepEqual(forgot.json, forgotUnknown.json);
  const reset = await call('POST', '/v1/auth/password/reset', { body: { email: 'g@exemplo.com', code: ctx.mailer.last('g@exemplo.com', 'password-reset')!.code, password: 'senha-nova-456' } });
  assert.equal(reset.status, 200);
  assert.equal((await call('GET', '/v1/me', { token })).status, 401, 'redefinir encerra as sessões');

  const fresh = (await call('POST', '/v1/auth/login', { body: { email: 'g@exemplo.com', password: 'senha-nova-456' } })).json.session.accessToken;
  assert.equal((await call('POST', '/v1/me/delete', { token: fresh, body: { password: 'errada' } })).status, 401);
  assert.equal((await call('POST', '/v1/me/delete', { token: fresh, body: { password: 'senha-nova-456' } })).status, 200);
  assert.equal((await call('POST', '/v1/auth/login', { body: { email: 'g@exemplo.com', password: 'senha-nova-456' } })).status, 401);
});

// ---------------------------------------------------------------------------------
// RSO (preparação) e criptografia
// ---------------------------------------------------------------------------------

test('RSO sem aprovação: indisponível, sem fingir verificação', async () => {
  const ctx = setup();
  const u = await signUp(ctx, 'Gregory');
  const call = httpClient(ctx.app);
  const status = await call('GET', '/v1/me/riot-accounts/rso/status', { token: u.tokens.accessToken });
  assert.equal(status.json.available, false);
  assert.match(status.json.reason, /aprovação/);
  const start = await call('POST', '/v1/me/riot-accounts/rso/start', { token: u.tokens.accessToken });
  assert.deepEqual([start.status, start.json.error.code], [503, 'RSO_NOT_CONFIGURED']);
  const cb = await call('GET', '/v1/auth/rso/callback?code=x&state=y');
  assert.equal(cb.status, 503);
  assert.match(cb.text, /aprovação/);
});

test('RSO configurado (provedor simulado): PKCE, state de uso único, tokens criptografados', async () => {
  const issuer = 'https://emissor.exemplo';
  const seen: Array<{ url: string; body?: string; auth?: string }> = [];
  const rsoFetch = async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    seen.push({ url, body: init?.body, auth: init?.headers?.Authorization });
    const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
    if (url === `${issuer}/.well-known/openid-configuration`) return reply(200, { authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token` });
    if (url === `${issuer}/token`) return reply(200, { access_token: 'ACESSO-SECRETO', refresh_token: 'RENOVACAO-SECRETA', expires_in: 3600 });
    if (url === `${issuer}/conta`) return reply(200, { puuid: 'puuid-gregory-000000000000000000000000', gameName: 'Gregory', tagLine: 'BR1' });
    return reply(404, {});
  };
  const { createApp } = await import('../src/app.ts');
  const { MemoryMailer } = await import('../src/auth/mailer.ts');
  const { FakeRiot, FakeClock, fakeDdragon, testConfig } = await import('./helpers.ts');
  const { silentLogger } = await import('../src/logger.ts');
  const riot = new FakeRiot();
  riot.matches = tenMatches();
  const mailer = new MemoryMailer();
  const app = createApp(testConfig({ rso: { clientId: 'cliente', clientSecret: 'segredo', redirectUri: 'https://app.exemplo/cb', issuer, accountUrl: `${issuer}/conta` } }), {
    fetchImpl: riot.fetch, ddragonFetch: fakeDdragon, clock: new FakeClock(), logger: silentLogger, mailer, rsoFetch,
  });
  const u = await signUp({ app, mailer }, 'Gregory');

  // Sem vincular antes pelo Riot ID, o RSO não cria contas com região inventada.
  const early = new URL((await app.rso.start(u.auth)).authorizationUrl);
  await assert.rejects(app.rso.callback({ code: 'c', state: early.searchParams.get('state') }), (e) => code(e) === 'NOT_FOUND');

  await app.riotLinks.link(u.auth, { gameName: 'Gregory', tagLine: 'BR1', region: 'BR' });
  const url = new URL((await app.rso.start(u.auth)).authorizationUrl);
  assert.equal(url.origin + url.pathname, `${issuer}/authorize`);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('client_id'), 'cliente');
  const state = url.searchParams.get('state')!;

  await assert.rejects(app.rso.callback({ code: 'c', state: 'state-falso' }), (e) => code(e) === 'INVALID_PARAMS');
  const linked = await app.rso.callback({ code: 'codigo-autorizacao', state });
  assert.equal(linked.gameName, 'Gregory');
  await assert.rejects(app.rso.callback({ code: 'codigo-autorizacao', state }), (e) => code(e) === 'INVALID_PARAMS', 'state de uso único');

  const tokenCall = seen.find((s) => s.url === `${issuer}/token`)!;
  assert.match(tokenCall.body!, /code_verifier=/);
  assert.match(tokenCall.auth!, /^Basic /);
  const account = app.riotLinks.list(u.auth)[0];
  assert.equal(account.verificationStatus, 'rso_verified');
  const raw = JSON.stringify(app.db.prepare('SELECT * FROM riot_accounts').all());
  assert.ok(!raw.includes('ACESSO-SECRETO') && !raw.includes('RENOVACAO-SECRETA'), 'tokens nunca em claro no banco');

  // Outro usuário não pode comprovar a mesma conta.
  const v = await signUp({ app, mailer }, 'Yuna');
  await app.riotLinks.link(v.auth, { gameName: 'Gregory', tagLine: 'BR1', region: 'BR' });
  const s2 = new URL((await app.rso.start(v.auth)).authorizationUrl).searchParams.get('state');
  await assert.rejects(app.rso.callback({ code: 'c2', state: s2 }), (e) => code(e) === 'RIOT_ACCOUNT_LINKED');
});

test('cifra dos tokens: ida e volta, e alteração detectada', () => {
  const cipher = new TokenCipher(Buffer.alloc(32, 1));
  const sealed = cipher.encrypt('token-do-rso');
  assert.notEqual(sealed, cipher.encrypt('token-do-rso'), 'IV aleatório');
  assert.equal(cipher.decrypt(sealed), 'token-do-rso');
  const parts = sealed.split('.');
  parts[3] = Buffer.from('outro conteúdo').toString('base64url');
  assert.throws(() => cipher.decrypt(parts.join('.')));
  assert.throws(() => new TokenCipher(Buffer.alloc(32, 2)).decrypt(sealed), 'outra chave não abre');
});

// ---------------------------------------------------------------------------------
// Migrações
// ---------------------------------------------------------------------------------

test('migração de um banco da versão anterior: progresso anônimo preservado à parte, nunca atribuído a usuários', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loi-mig-'));
  const file = join(dir, 'antigo.db');
  try {
    // Banco como existia antes: só a migração 1, com progresso do treinador por PUUID.
    const old = new DatabaseSync(file);
    MIGRATIONS[0].up(old);
    old.exec('PRAGMA user_version = 1');
    old.prepare("INSERT INTO lesson_progress (puuid, lesson_id, completed_at, best_score) VALUES ('puuid-anonimo', 'f-last-hit', 1, 1)").run();
    old.prepare("INSERT INTO accounts (puuid, game_name, tag_line, region, first_seen_at, updated_at) VALUES ('puuid-anonimo', 'Gregory', 'BR1', 'BR', 1, 1)").run();
    old.close();

    const db = openDatabase(file);
    assert.equal((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, SCHEMA_VERSION);
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((t) => t.name);
    for (const t of ['users', 'user_sessions', 'email_verification_tokens', 'password_reset_tokens', 'riot_accounts', 'academy_progress', 'challenge_progress', 'replay_analyses', 'user_settings']) {
      assert.ok(tables.includes(t), t);
    }
    assert.ok(tables.includes('legacy_lesson_progress'), 'tabela com dados vira legacy_');
    assert.ok(!tables.includes('quiz_attempts') && !tables.includes('legacy_quiz_attempts'), 'tabela vazia é removida');
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM legacy_lesson_progress').get() as { n: number }).n, 1);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n, 0);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM academy_progress').get() as { n: number }).n, 0);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM accounts').get() as { n: number }).n, 1, 'dados públicos preservados');
    db.close();

    // Reabrir não reaplica nada.
    const again = openDatabase(file);
    assert.equal((again.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, SCHEMA_VERSION);
    again.close();

    // Banco novo: sem tabelas legacy.
    const fresh = openDatabase(':memory:');
    assert.equal((fresh.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE 'legacy_%'").get() as { n: number }).n, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('restrições do banco: e-mail único, conta comprovada única e exclusão em cascata', async () => {
  const ctx = setup();
  const u = await signUp(ctx, 'Gregory');
  assert.throws(() => ctx.app.db.prepare("INSERT INTO users (id, username, email, password_hash, password_changed_at, created_at, updated_at) VALUES ('usr_x', 'outro', ?, 'h', 1, 1, 1)").run(u.email));
  assert.throws(() => ctx.app.db.prepare("INSERT INTO user_settings (user_id, match_count, updated_at) VALUES ('usr_inexistente', 20, 1)").run(), 'chave estrangeira');
  assert.throws(() => ctx.app.db.prepare("INSERT INTO riot_accounts (id, user_id, puuid, game_name, tag_line, region, verification_status, linked_at) VALUES ('r1', ?, 'p', 'a', 'b', 'BR', 'falso', 1)").run(u.userId));
  const v = await signUp(ctx, 'Yuna');
  const insert = (id: string, user: string) =>
    ctx.app.db.prepare("INSERT INTO riot_accounts (id, user_id, puuid, game_name, tag_line, region, verification_status, linked_at) VALUES (?, ?, 'mesmo', 'a', 'b', 'BR', 'rso_verified', 1)").run(id, user);
  insert('r2', u.userId);
  assert.throws(() => insert('r3', v.userId), 'mesma conta comprovada por dois usuários');
});
