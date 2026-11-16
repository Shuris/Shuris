import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { AuthService, Authenticated, RequestContext } from '../auth/authService.ts';
import { toPublicUser } from '../auth/authService.ts';
import type { AuthRepository } from '../auth/authRepository.ts';
import type { RiotLinkService } from '../auth/riotLinkService.ts';
import type { RsoService } from '../auth/rso.ts';
import type { AcademyService, LessonService } from '../coach/services.ts';
import { AppError } from '../errors.ts';
import type { Logger } from '../logger.ts';
import { isRegion, REGION_CODES } from '../regions.ts';
import type { AccountService } from '../services/accountService.ts';
import { ALLOWED_COUNTS } from '../services/syncService.ts';
import type { MatchupNotesService } from '../notes/matchupNotes.ts';
import type { ChallengeService } from '../challenges/challengeService.ts';
import type { ReplayAnalysisService } from '../challenges/replayAnalyses.ts';

export interface HttpDeps {
  accounts: AccountService;
  academy: AcademyService;
  lessons: LessonService;
  auth: AuthService;
  authRepo: AuthRepository;
  riotLinks: RiotLinkService;
  rso: RsoService;
  matchups: MatchupNotesService;
  challenge: ChallengeService;
  replays: ReplayAnalysisService;
  logger: Logger;
  hasApiKey: () => boolean;
  /** "console" = modo de desenvolvimento: nenhum e-mail é enviado, os códigos aparecem no terminal. */
  emailDelivery?: string;
  /** Requisições por minuto aceitas de um mesmo cliente. */
  clientLimitPerMinute?: number;
  /** Origens autorizadas a chamar a API pelo navegador (CORS). ["*"] = qualquer uma (desenvolvimento). */
  allowedOrigins?: string[];
  /** Atrás de um proxy HTTPS (Nginx, Render, Fly...): usa o primeiro IP de X-Forwarded-For. */
  trustProxy?: boolean;
  /** Modo pessoal: requisições sem token da própria máquina ou da rede local usam o usuário local. */
  personalMode?: boolean;
}

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

const json = (res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) => {
  res.writeHead(status, { ...BASE_HEADERS, ...extra });
  res.end(JSON.stringify(body));
};

const html = (res: ServerResponse, status: number, title: string, message: string) => {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  res.end(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<body style="font-family:system-ui;background:#07090D;color:#F1F3F6;padding:32px;max-width:520px;margin:auto"><h1 style="font-size:20px">${esc(title)}</h1><p style="color:#A7B0BE">${esc(message)}</p></body></html>`);
};

const MAX_BODY = 4096;

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    throw new AppError('INVALID_PARAMS', 'Parâmetro malformado na URL.');
  }
};

/**
 * Roteador sobre node:http.
 * - Públicas: /health, catálogo de aulas e as rotas de cadastro/login/recuperação.
 * - Todo o resto exige `Authorization: Bearer <token de acesso>`; o usuário é sempre
 *   o dono do token — nenhuma rota aceita um ID de usuário vindo do cliente.
 * - A chave da Riot e os tokens nunca aparecem em respostas nem em logs.
 */
export function createHttpHandler(deps: HttpDeps) {
  const limit = deps.clientLimitPerMinute ?? 120;
  const hits = new Map<string, number[]>();

  const throttle = (ip: string) => {
    const now = Date.now();
    const list = (hits.get(ip) ?? []).filter((t) => t > now - 60_000);
    list.push(now);
    hits.set(ip, list);
    if (hits.size > 5000) hits.clear();
    if (list.length > limit) throw new AppError('RATE_LIMITED', 'Muitas requisições deste dispositivo. Aguarde um instante.', { retryAfterSec: 30 });
  };

  const readJson = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > MAX_BODY) throw new AppError('INVALID_PARAMS', 'Corpo da requisição grande demais.');
    }
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('formato');
      return parsed as Record<string, unknown>;
    } catch {
      throw new AppError('INVALID_PARAMS', 'Corpo da requisição não é um JSON válido.');
    }
  };

  const countParam = (url: URL): number => {
    const count = Number(url.searchParams.get('count') ?? 20);
    if (!ALLOWED_COUNTS.includes(count as (typeof ALLOWED_COUNTS)[number])) {
      throw new AppError('INVALID_PARAMS', `"count" deve ser um de: ${ALLOWED_COUNTS.join(', ')}.`);
    }
    return count;
  };

  const allowed = deps.allowedOrigins?.length ? deps.allowedOrigins : ['*'];
  /** Valor do cabeçalho CORS para a origem da requisição (nada = navegador bloqueia). */
  const corsOrigin = (o: string | undefined): string | null => (allowed.includes('*') ? '*' : o && allowed.includes(o) ? o : null);
  const clientIp = (req: IncomingMessage): string => {
    if (deps.trustProxy) {
      const fwd = req.headers['x-forwarded-for'];
      const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
      if (first) return first.slice(0, 64);
    }
    return req.socket.remoteAddress ?? 'desconhecido';
  };

  /** Endereços que nunca vêm da internet: a própria máquina e redes locais (IPv4/IPv6). */
  const isLocal = (ip: string) => {
    const v = ip.replace(/^::ffff:/, '');
    return v === '::1' || /^127\./.test(v) || /^10\./.test(v) || /^192\.168\./.test(v) || /^172\.(1[6-9]|2\d|3[01])\./.test(v) || /^f[cd][0-9a-f]{2}:/i.test(v) || /^fe80:/i.test(v);
  };
  /**
   * Com token, valida a sessão normalmente. Sem token, no modo pessoal e vindo
   * da rede local, usa o usuário local; vindo da internet, continua exigindo login.
   */
  const resolveAuth = (req: IncomingMessage) => {
    if (!req.headers.authorization && deps.personalMode && isLocal(clientIp(req))) return deps.auth.personalAuth();
    return deps.auth.authenticate(req.headers.authorization);
  };

  const context = (req: IncomingMessage): RequestContext => {
    const header = req.headers['x-client'] ?? req.headers['user-agent'] ?? '';
    return { ip: clientIp(req), client: (Array.isArray(header) ? header[0] : header).slice(0, 200) };
  };

  const meView = (auth: Authenticated) => {
    const user = deps.authRepo.userById(auth.user.id)!;
    return { user: toPublicUser(user), riotAccounts: deps.riotLinks.list(auth), settings: deps.authRepo.settings(user.id), rso: deps.rso.status() };
  };

  /** Rotas públicas de autenticação: /v1/auth/... */
  const authRoute = async (req: IncomingMessage, url: URL, parts: string[]): Promise<unknown> => {
    const path = parts.slice(2).join('/');
    const ctx = context(req);
    if (req.method === 'POST') {
      if (path === 'register') return deps.auth.register(await readJson(req), ctx);
      if (path === 'login') return deps.auth.login(await readJson(req), ctx);
      if (path === 'refresh') return deps.auth.refresh((await readJson(req)).refreshToken, ctx);
      if (path === 'password/forgot') {
        await deps.auth.forgotPassword((await readJson(req)).email, ctx);
        return { ok: true, message: 'Se existir uma conta com esse e-mail, enviamos um código de redefinição.' };
      }
      if (path === 'password/reset') {
        await deps.auth.resetPassword(await readJson(req), ctx);
        return { ok: true };
      }
      if (path === 'logout') {
        deps.auth.logout(deps.auth.authenticate(req.headers.authorization));
        return { ok: true };
      }
    }
    if (req.method === 'GET' && path === 'rso/callback') return { __rsoCallback: url };
    throw new AppError('NOT_FOUND', 'Rota não encontrada.');
  };

  /** Rotas do usuário autenticado: /v1/me/... */
  const meRoute = async (req: IncomingMessage, url: URL, parts: string[], auth: Authenticated): Promise<unknown> => {
    const path = parts.slice(2);
    const at = (...segments: string[]) => segments.length === path.length && segments.every((s, i) => s === '*' || s === path[i]);
    const m = req.method;

    if (m === 'GET' && path.length === 0) return meView(auth);
    if (m === 'POST' && at('email', 'verify')) return { user: deps.auth.verifyEmail(auth, (await readJson(req)).code) };
    if (m === 'POST' && at('email', 'resend')) {
      await deps.auth.resendVerification(auth);
      return { ok: true };
    }
    if (m === 'POST' && at('password')) {
      await deps.auth.changePassword(auth, await readJson(req));
      return { ok: true };
    }
    if (m === 'POST' && at('delete')) {
      await deps.auth.deleteAccount(auth, (await readJson(req)).password);
      return { ok: true };
    }
    if (m === 'POST' && at('settings')) {
      const body = await readJson(req);
      const current = deps.authRepo.settings(auth.user.id);
      const matchCount = body.matchCount === undefined ? current.matchCount : Number(body.matchCount);
      if (!ALLOWED_COUNTS.includes(matchCount as (typeof ALLOWED_COUNTS)[number])) throw new AppError('INVALID_PARAMS', 'Quantidade de partidas inválida.');
      const region = body.preferredRegion === undefined ? current.preferredRegion : body.preferredRegion;
      if (region !== null && (typeof region !== 'string' || !isRegion(region))) throw new AppError('INVALID_REGION', 'Região inválida.');
      deps.authRepo.saveSettings(auth.user.id, { matchCount: matchCount as 10 | 20 | 50 | 100, preferredRegion: region }, Date.now());
      return { settings: deps.authRepo.settings(auth.user.id) };
    }

    if (m === 'GET' && at('sessions')) return { sessions: deps.auth.sessions(auth) };
    if (m === 'POST' && at('sessions', 'revoke-others')) return { revoked: deps.auth.revokeOtherSessions(auth) };
    if (m === 'DELETE' && at('sessions', '*')) {
      deps.auth.revokeSession(auth, decode(path[1]));
      return { ok: true };
    }

    if (m === 'GET' && at('riot-accounts', 'rso', 'status')) return deps.rso.status();
    if (m === 'POST' && at('riot-accounts', 'rso', 'start')) return deps.rso.start(auth);
    if (m === 'GET' && at('riot-accounts')) return { riotAccounts: deps.riotLinks.list(auth) };
    if (m === 'POST' && at('riot-accounts')) return { riotAccount: await deps.riotLinks.link(auth, await readJson(req)) };
    if (m === 'POST' && at('riot-accounts', '*', 'primary')) return { riotAccounts: deps.riotLinks.setPrimary(auth, decode(path[1])) };
    if (m === 'DELETE' && at('riot-accounts', '*')) return { riotAccounts: deps.riotLinks.unlink(auth, decode(path[1])) };

    if (m === 'GET' && at('matchups')) return { notes: deps.matchups.list(auth.user.id) };
    if (m === 'POST' && at('matchups')) return { note: deps.matchups.save(auth.user.id, await readJson(req)) };
    if (m === 'DELETE' && at('matchups', '*', '*')) {
      deps.matchups.remove(auth.user.id, decode(path[1]), decode(path[2]));
      return { ok: true };
    }

    if (m === 'GET' && at('challenge')) return deps.challenge.state(auth.user.id, url.searchParams.get('tz'));
    if (m === 'POST' && at('challenge', 'attempts')) return deps.challenge.submit(auth.user.id, await readJson(req));
    if (m === 'GET' && at('challenge', 'ranking')) return deps.challenge.ranking(auth.user.id);
    if (m === 'POST' && at('challenge', 'ranking')) return deps.challenge.setOptIn(auth.user.id, (await readJson(req)).optIn);

    if (m === 'GET' && at('replay-analyses')) return { analyses: deps.replays.list(auth.user.id) };
    if (m === 'POST' && at('replay-analyses')) return { analysis: deps.replays.save(auth.user.id, await readJson(req)) };

    if (path[0] === 'coach') {
      const count = countParam(url);
      if (m === 'GET' && at('coach')) return deps.academy.report(auth.user.id, count);
      if (m === 'POST' && at('coach', 'attempts')) {
        const body = await readJson(req);
        if (typeof body.lessonId !== 'string') throw new AppError('INVALID_PARAMS', 'Informe a aula do teste.');
        return deps.academy.submitAttempt(auth.user.id, count, body.lessonId, body.answers, body.durationSec);
      }
      if (m === 'POST' && at('coach', 'goal')) return deps.academy.setGoal(auth.user.id, count, (await readJson(req)).rank ?? null);
      if (m === 'POST' && at('coach', 'plan-day')) {
        const body = await readJson(req);
        return deps.academy.setPlanDay(auth.user.id, count, body.day, body.done);
      }
    }
    throw new AppError('NOT_FOUND', 'Rota não encontrada.');
  };

  const route = async (req: IncomingMessage): Promise<unknown> => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean);

    if (url.pathname === '/health' && req.method === 'GET') {
      return { ok: true, service: 'lol-insight-server', personalMode: !!deps.personalMode, riotApiKeyConfigured: deps.hasApiKey(), emailDelivery: deps.emailDelivery ?? 'console', regions: REGION_CODES, time: Date.now() };
    }
    throttle(clientIp(req));

    if (url.pathname === '/v1/academy/lessons' && req.method === 'GET') return { lessons: deps.lessons.list() };
    if (parts[0] === 'v1' && parts[1] === 'auth') return authRoute(req, url, parts);

    // Daqui em diante, tudo exige sessão válida.
    const auth = resolveAuth(req);
    if (parts[0] === 'v1' && parts[1] === 'me') return meRoute(req, url, parts, auth);
    if (req.method !== 'GET') throw new AppError('NOT_FOUND', 'Rota não encontrada.');

    // GET /v1/accounts/:region/:gameName/:tagLine?count=20&refresh=1 — dados públicos da Riot.
    if (parts.length === 5 && parts[0] === 'v1' && parts[1] === 'accounts') {
      const region = decode(parts[2]).toUpperCase();
      if (!isRegion(region)) throw new AppError('INVALID_REGION', `Região inválida. Use uma de: ${REGION_CODES.join(', ')}.`);
      return deps.accounts.getBundle(region, decode(parts[3]), decode(parts[4]), { count: countParam(url), refresh: url.searchParams.get('refresh') === '1' });
    }

    // GET /v1/matches/:matchId/details?puuid=...
    if (parts.length === 4 && parts[0] === 'v1' && parts[1] === 'matches' && parts[3] === 'details') {
      const matchId = decode(parts[2]);
      const puuid = url.searchParams.get('puuid') ?? '';
      if (!/^[A-Z0-9]{2,5}_\d{5,}$/.test(matchId) || !/^[\w-]{20,100}$/.test(puuid)) {
        throw new AppError('INVALID_PARAMS', 'Identificador de partida ou de jogador inválido.');
      }
      return deps.accounts.getMatchDetails(matchId, puuid);
    }

    throw new AppError('NOT_FOUND', 'Rota não encontrada.');
  };

  return async (req: IncomingMessage, res: ServerResponse) => {
    const started = Date.now();
    const origin = corsOrigin(req.headers.origin);
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      if (origin !== '*') res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(origin ? 204 : 403, {
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client',
        'Access-Control-Max-Age': '600',
      });
      res.end();
      return;
    }
    let status = 200;
    try {
      const result = await route(req);
      const callback = (result as { __rsoCallback?: URL } | null)?.__rsoCallback;
      if (callback) {
        try {
          const linked = await deps.rso.callback({ code: callback.searchParams.get('code'), state: callback.searchParams.get('state'), error: callback.searchParams.get('error') });
          html(res, 200, 'Conta Riot verificada', `${linked.gameName}#${linked.tagLine} foi verificada. Volte ao LOL Insight.`);
        } catch (e) {
          const err = e instanceof AppError ? e : new AppError('INTERNAL', 'Erro interno do servidor.');
          status = err.status;
          html(res, status, 'Não foi possível verificar a conta', err.message);
        }
      } else {
        json(res, 200, result);
      }
    } catch (e) {
      const err = e instanceof AppError ? e : new AppError('INTERNAL', 'Erro interno do servidor.');
      if (!(e instanceof AppError)) deps.logger.error('http: erro inesperado', { reason: e instanceof Error ? e.message : String(e) });
      status = err.status;
      const retry = err.details.retryAfterSec;
      json(res, status, err.toJSON(), typeof retry === 'number' ? { 'Retry-After': String(retry) } : {});
    }
    // Registra só método, caminho (sem query) e resultado — nunca cabeçalhos ou corpo.
    deps.logger.info('http', { method: req.method, path: (req.url ?? '').split('?')[0], status, ms: Date.now() - started });
  };
}

export function startHttpServer(deps: HttpDeps, port: number, host: string): Promise<Server> {
  const server = createServer(createHttpHandler(deps));
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}

/** Monta as dependências HTTP a partir do App. */
export function httpDepsFrom(app: { accounts: AccountService; academy: AcademyService; lessons: LessonService; auth: AuthService; authRepo: AuthRepository; riotLinks: RiotLinkService; rso: RsoService; matchups: MatchupNotesService; challenge: ChallengeService; replays: ReplayAnalysisService; logger: Logger; client: { hasKey: boolean } }): HttpDeps {
  return { accounts: app.accounts, academy: app.academy, lessons: app.lessons, auth: app.auth, authRepo: app.authRepo, riotLinks: app.riotLinks, rso: app.rso, matchups: app.matchups, challenge: app.challenge, replays: app.replays, logger: app.logger, hasApiKey: () => app.client.hasKey };
}
