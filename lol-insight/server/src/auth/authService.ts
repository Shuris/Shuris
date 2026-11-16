import { AppError } from '../errors.ts';
import type { Logger } from '../logger.ts';
import type { AuthRepository, SessionRow, UserRow } from './authRepository.ts';
import { hashCode, newCode, newId, newToken, safeEqualHex, sha256 } from './crypto.ts';
import type { Mailer } from './mailer.ts';
import { assertPasswordPolicy, hashPassword, needsRehash, verifyPassword, type HashParams } from './password.ts';
import type { Throttle } from './throttle.ts';

export const ACCESS_TTL_MS = 15 * 60_000;
export const REFRESH_TTL_MS = 30 * 86_400_000;
const VERIFY_TTL_MS = 24 * 3_600_000;
const RESET_TTL_MS = 15 * 60_000;
const MAX_CODE_ATTEMPTS = 5;
const TOUCH_INTERVAL_MS = 60_000;

const MIN = 60_000;
const LIMITS = {
  loginAccount: { max: 5, windowMs: 15 * MIN },
  loginIp: { max: 30, windowMs: 15 * MIN },
  register: { max: 10, windowMs: 60 * MIN },
  forgotEmail: { max: 3, windowMs: 60 * MIN },
  forgotIp: { max: 10, windowMs: 60 * MIN },
  resetIp: { max: 20, windowMs: 60 * MIN },
  verifySend: { max: 3, windowMs: 60 * MIN },
};

export interface RequestContext {
  ip: string;
  client: string;
}

export interface SessionTokens {
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
}

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  createdAt: number;
}

export interface AuthResult {
  user: PublicUser;
  session: SessionTokens;
}

export interface Authenticated {
  user: UserRow;
  sessionId: string;
}

export const toPublicUser = (u: UserRow): PublicUser => ({ id: u.id, username: u.username, email: u.email, emailVerified: u.emailVerifiedAt !== null, createdAt: u.createdAt });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,20}$/;

export function normalizeEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) throw new AppError('INVALID_EMAIL', 'Informe um e-mail válido.');
  return email;
}

export function normalizeUsername(value: unknown): string {
  const username = typeof value === 'string' ? value.trim() : '';
  if (!USERNAME_RE.test(username)) throw new AppError('INVALID_USERNAME', 'O nome de usuário deve ter de 3 a 20 caracteres: letras, números, ponto, hífen ou sublinhado.');
  return username;
}

function sanitizeClient(value: string): string {
  return value.replace(/[^\p{L}\p{N} .,;:()/_+·-]/gu, '').slice(0, 80) || 'Desconhecido';
}

/**
 * Autenticação: cadastro, login, sessões, verificação de e-mail e redefinição de senha.
 *
 * - Senhas: scrypt com sal aleatório (password.ts). Nunca em texto puro.
 * - Sessões: token de acesso (15 min) + token de renovação (30 dias) trocado a cada
 *   uso. Ambos guardados só como SHA-256. Reuso de um token de renovação já trocado
 *   revoga a sessão inteira (sinal de token roubado).
 * - Mensagens genéricas onde a resposta poderia revelar se um e-mail existe.
 * - Limite de tentativas por conta e por IP, persistido no banco.
 */
export class AuthService {
  /** Hash de uma senha qualquer, usado para igualar o tempo de resposta quando o e-mail não existe. */
  private dummyHash: Promise<string>;

  constructor(
    private repo: AuthRepository,
    private throttle: Throttle,
    private mailer: Mailer,
    private secret: Buffer,
    private hashParams: HashParams,
    private logger: Logger,
    private now: () => number = Date.now,
  ) {
    this.dummyHash = hashPassword('senha-que-nao-existe', hashParams);
  }

  // ---- Cadastro e login ----

  async register(input: { username?: unknown; email?: unknown; password?: unknown }, ctx: RequestContext): Promise<AuthResult> {
    const username = normalizeUsername(input.username);
    const email = normalizeEmail(input.email);
    const password = assertPasswordPolicy(input.password, { email, username });
    this.throttle.check(`register:ip:${ctx.ip}`, LIMITS.register, 'Muitos cadastros feitos a partir desta rede.');
    this.throttle.hit(`register:ip:${ctx.ip}`);
    if (this.repo.usernameTaken(username)) throw new AppError('USERNAME_TAKEN', 'Esse nome de usuário já está em uso.');
    if (this.repo.emailTaken(email)) throw new AppError('EMAIL_TAKEN', 'Já existe uma conta com esse e-mail. Entre ou recupere a senha.');

    const passwordHash = await hashPassword(password, this.hashParams);
    const id = newId('usr');
    const now = this.now();
    try {
      this.repo.createUser({ id, username, email, passwordHash, now });
    } catch (e) {
      // Corrida entre dois cadastros simultâneos: o índice único é a garantia final.
      if (String(e).includes('UNIQUE')) throw new AppError('EMAIL_TAKEN', 'Já existe uma conta com esses dados.');
      throw e;
    }
    await this.sendVerification(this.repo.userById(id)!);
    this.logger.info('auth: conta criada', { userId: id });
    return { user: toPublicUser(this.repo.userById(id)!), session: this.createSession(id, ctx) };
  }

  async login(input: { email?: unknown; password?: unknown }, ctx: RequestContext): Promise<AuthResult> {
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    const accountKey = `login:account:${email}`;
    const ipKey = `login:ip:${ctx.ip}`;
    this.throttle.check(ipKey, LIMITS.loginIp, 'Muitas tentativas de login a partir desta rede.');
    this.throttle.check(accountKey, LIMITS.loginAccount, 'Muitas tentativas de login nesta conta.');

    const user = email ? this.repo.userByEmail(email) : null;
    // Sempre calcula um hash, exista ou não a conta, para não revelar e-mails cadastrados pelo tempo de resposta.
    const ok = user ? await verifyPassword(password, user.passwordHash) : (await verifyPassword(password, await this.dummyHash), false);
    if (!user || !ok) {
      this.throttle.hit(accountKey);
      this.throttle.hit(ipKey);
      this.logger.warn('auth: login recusado', { ip: ctx.ip });
      throw new AppError('INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
    }
    this.throttle.clear(accountKey);
    if (needsRehash(user.passwordHash, this.hashParams)) this.repo.setPassword(user.id, await hashPassword(password, this.hashParams), this.now(), false);
    return { user: toPublicUser(user), session: this.createSession(user.id, ctx) };
  }

  // ---- Sessões ----

  private createSession(userId: string, ctx: RequestContext): SessionTokens {
    const now = this.now();
    const tokens = this.issue(now);
    this.repo.createSession({
      id: newId('ses'),
      userId,
      accessHash: sha256(tokens.accessToken),
      accessExpiresAt: tokens.accessExpiresAt,
      refreshHash: sha256(tokens.refreshToken),
      refreshExpiresAt: tokens.refreshExpiresAt,
      client: sanitizeClient(ctx.client),
      ip: ctx.ip,
      now,
    });
    return tokens;
  }

  private issue(now: number): SessionTokens {
    return { accessToken: newToken(), accessExpiresAt: now + ACCESS_TTL_MS, refreshToken: newToken(), refreshExpiresAt: now + REFRESH_TTL_MS };
  }

  /** Valida o token de acesso enviado em `Authorization: Bearer`. */
  authenticate(header: string | undefined): Authenticated {
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new AppError('AUTH_REQUIRED', 'Entre na sua conta para continuar.');
    const s = this.repo.sessionByAccess(sha256(token));
    const now = this.now();
    if (!s || s.revokedAt !== null || s.refreshExpiresAt <= now) throw new AppError('AUTH_REQUIRED', 'Sua sessão terminou. Entre novamente.');
    if (s.accessExpiresAt <= now) throw new AppError('TOKEN_EXPIRED', 'O token de acesso expirou. Renove a sessão.');
    const user = this.repo.userById(s.userId);
    if (!user) throw new AppError('AUTH_REQUIRED', 'Sua sessão terminou. Entre novamente.');
    if (now - s.lastUsedAt > TOUCH_INTERVAL_MS) this.repo.touchSession(s.id, now);
    return { user, sessionId: s.id };
  }

  /** Troca o token de renovação por um par novo (rotação). */
  refresh(refreshToken: unknown, ctx: RequestContext): AuthResult {
    const token = typeof refreshToken === 'string' ? refreshToken : '';
    const hash = sha256(token);
    const now = this.now();
    const s = token ? this.repo.sessionByRefresh(hash) : null;
    if (!s) {
      // Token já trocado sendo usado de novo: alguém pode ter copiado o token antigo. Encerra a sessão.
      const reused = token ? this.repo.sessionByPreviousRefresh(hash) : null;
      if (reused && reused.revokedAt === null) {
        this.repo.revokeSession(reused.id, reused.userId, 'reuso de token de renovação', now);
        this.logger.warn('auth: reuso de token de renovação — sessão revogada', { sessionId: reused.id });
      }
      throw new AppError('AUTH_REQUIRED', 'Sua sessão terminou. Entre novamente.');
    }
    if (s.revokedAt !== null || s.refreshExpiresAt <= now) throw new AppError('AUTH_REQUIRED', 'Sua sessão terminou. Entre novamente.');
    const tokens = this.issue(now);
    this.repo.rotateSession(s.id, {
      accessHash: sha256(tokens.accessToken),
      accessExpiresAt: tokens.accessExpiresAt,
      refreshHash: sha256(tokens.refreshToken),
      refreshExpiresAt: tokens.refreshExpiresAt,
      previousRefreshHash: hash,
      ip: ctx.ip,
      now,
    });
    return { user: toPublicUser(this.repo.userById(s.userId)!), session: tokens };
  }

  logout(auth: Authenticated): void {
    this.repo.revokeSession(auth.sessionId, auth.user.id, 'logout', this.now());
  }

  sessions(auth: Authenticated) {
    return this.repo.activeSessions(auth.user.id, this.now()).map((s: SessionRow) => ({
      id: s.id,
      client: s.client,
      ip: s.ip,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      current: s.id === auth.sessionId,
    }));
  }

  /** Revoga uma sessão do próprio usuário. Sessões de outros usuários são tratadas como inexistentes. */
  revokeSession(auth: Authenticated, sessionId: string): void {
    if (!this.repo.revokeSession(sessionId, auth.user.id, 'encerrada pelo usuário', this.now())) throw new AppError('NOT_FOUND', 'Sessão não encontrada.');
  }

  revokeOtherSessions(auth: Authenticated): number {
    return this.repo.revokeAllSessions(auth.user.id, 'encerrada pelo usuário', this.now(), auth.sessionId);
  }

  // ---- Verificação de e-mail ----

  private async sendVerification(user: UserRow): Promise<void> {
    const code = newCode();
    const id = newId('evt');
    const now = this.now();
    this.repo.createCode('email_verification_tokens', { id, userId: user.id, codeHash: hashCode(this.secret, id, code), expiresAt: now + VERIFY_TTL_MS, now });
    await this.mailer.send({
      to: user.email,
      kind: 'verify-email',
      code,
      subject: 'Confirme seu e-mail no LOL Insight',
      text: `Olá, ${user.username}! Seu código de confirmação é ${code}. Ele vale por 24 horas.`,
    });
  }

  async resendVerification(auth: Authenticated): Promise<void> {
    if (auth.user.emailVerifiedAt !== null) return;
    const key = `verify:send:${auth.user.id}`;
    this.throttle.check(key, LIMITS.verifySend, 'Muitos códigos enviados.');
    this.throttle.hit(key);
    await this.sendVerification(auth.user);
  }

  verifyEmail(auth: Authenticated, code: unknown): PublicUser {
    if (auth.user.emailVerifiedAt === null) {
      this.consumeCode('email_verification_tokens', auth.user.id, code);
      this.repo.markEmailVerified(auth.user.id, this.now());
    }
    return toPublicUser(this.repo.userById(auth.user.id)!);
  }

  /** Confere um código: no máximo 5 tentativas por código, que expira e é de uso único. */
  private consumeCode(table: 'email_verification_tokens' | 'password_reset_tokens', userId: string, code: unknown): void {
    const value = typeof code === 'string' ? code.trim() : '';
    const now = this.now();
    const token = this.repo.activeCode(table, userId, now);
    if (!token || token.attempts >= MAX_CODE_ATTEMPTS) throw new AppError('INVALID_CODE', 'Código inválido ou expirado. Peça um novo código.');
    this.repo.addCodeAttempt(table, token.id);
    if (!/^\d{6}$/.test(value) || !safeEqualHex(hashCode(this.secret, token.id, value), token.codeHash)) {
      const left = MAX_CODE_ATTEMPTS - token.attempts - 1;
      throw new AppError('INVALID_CODE', left > 0 ? `Código incorreto. Restam ${left} ${left === 1 ? 'tentativa' : 'tentativas'}.` : 'Código incorreto. Peça um novo código.');
    }
    this.repo.useCode(table, token.id, now);
  }

  // ---- Senha ----

  /** Sempre responde igual, exista ou não a conta, para não revelar e-mails cadastrados. */
  async forgotPassword(emailInput: unknown, ctx: RequestContext): Promise<void> {
    const email = normalizeEmail(emailInput);
    this.throttle.check(`forgot:ip:${ctx.ip}`, LIMITS.forgotIp, 'Muitos pedidos de redefinição a partir desta rede.');
    this.throttle.hit(`forgot:ip:${ctx.ip}`);
    const emailKey = `forgot:email:${email}`;
    if (this.throttle.retryAfter(emailKey, LIMITS.forgotEmail) > 0) return; // limite silencioso
    this.throttle.hit(emailKey);
    const user = this.repo.userByEmail(email);
    if (!user) return;
    const code = newCode();
    const id = newId('prt');
    const now = this.now();
    this.repo.createCode('password_reset_tokens', { id, userId: user.id, codeHash: hashCode(this.secret, id, code), expiresAt: now + RESET_TTL_MS, now });
    await this.mailer.send({
      to: user.email,
      kind: 'password-reset',
      code,
      subject: 'Redefinição de senha do LOL Insight',
      text: `Recebemos um pedido para redefinir sua senha. Código: ${code} (vale por 15 minutos). Se não foi você, ignore esta mensagem.`,
    });
  }

  async resetPassword(input: { email?: unknown; code?: unknown; password?: unknown }, ctx: RequestContext): Promise<void> {
    this.throttle.check(`reset:ip:${ctx.ip}`, LIMITS.resetIp, 'Muitas tentativas de redefinição a partir desta rede.');
    this.throttle.hit(`reset:ip:${ctx.ip}`);
    const email = normalizeEmail(input.email);
    const user = this.repo.userByEmail(email);
    if (!user) throw new AppError('INVALID_CODE', 'Código inválido ou expirado. Peça um novo código.');
    const password = assertPasswordPolicy(input.password, { email, username: user.username });
    this.consumeCode('password_reset_tokens', user.id, input.code);
    const now = this.now();
    this.repo.setPassword(user.id, await hashPassword(password, this.hashParams), now);
    // Quem recebeu o código comprovou o acesso ao e-mail.
    this.repo.markEmailVerified(user.id, now);
    this.repo.revokeAllSessions(user.id, 'senha redefinida', now);
    this.throttle.clear(`login:account:${email}`);
    this.logger.info('auth: senha redefinida', { userId: user.id });
  }

  async changePassword(auth: Authenticated, input: { currentPassword?: unknown; newPassword?: unknown }): Promise<void> {
    const key = `password:change:${auth.user.id}`;
    this.throttle.check(key, LIMITS.loginAccount, 'Muitas tentativas.');
    if (typeof input.currentPassword !== 'string' || !(await verifyPassword(input.currentPassword, auth.user.passwordHash))) {
      this.throttle.hit(key);
      throw new AppError('INVALID_CREDENTIALS', 'Senha atual incorreta.');
    }
    const password = assertPasswordPolicy(input.newPassword, { email: auth.user.email, username: auth.user.username });
    const now = this.now();
    this.repo.setPassword(auth.user.id, await hashPassword(password, this.hashParams), now);
    // As outras sessões caem; a atual continua.
    this.repo.revokeAllSessions(auth.user.id, 'senha alterada', now, auth.sessionId);
    this.throttle.clear(key);
  }

  /** Exclusão definitiva: pede a senha e apaga todos os dados pessoais (cascata no banco). */
  async deleteAccount(auth: Authenticated, password: unknown): Promise<void> {
    const key = `delete:${auth.user.id}`;
    this.throttle.check(key, LIMITS.loginAccount, 'Muitas tentativas.');
    if (typeof password !== 'string' || !(await verifyPassword(password, auth.user.passwordHash))) {
      this.throttle.hit(key);
      throw new AppError('INVALID_CREDENTIALS', 'Senha incorreta.');
    }
    this.repo.deleteUser(auth.user.id);
    this.throttle.clear(key);
    this.logger.info('auth: conta excluída', { userId: auth.user.id });
  }
}
