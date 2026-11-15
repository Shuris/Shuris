import { parseRateLimits } from '../config.ts';
import { AppError, RiotNotFoundError } from '../errors.ts';
import { silentLogger, type Logger } from '../logger.ts';
import { RateLimitExceededError, RateLimiter, systemClock, type Clock } from './rateLimiter.ts';

export type FetchLike = (url: string, init: { headers: Record<string, string>; signal?: AbortSignal }) => Promise<Response>;

export interface RiotClientOptions {
  apiKey: string;
  limiter: RateLimiter;
  fetchImpl?: FetchLike;
  logger?: Logger;
  clock?: Clock;
  /** Tentativas extras para falhas temporárias (5xx, rede, 429). */
  maxRetries?: number;
  timeoutMs?: number;
}

export interface RequestOptions {
  query?: Record<string, string | number | undefined>;
  /**
   * Espera máxima aceitável por causa de rate limit. Buscas iniciadas pelo
   * usuário usam valores curtos; a coleta em segundo plano pode esperar mais.
   */
  maxWaitMs?: number;
}

const DEFAULT_RETRY_AFTER_MS = 5000;

/**
 * Cliente HTTP da Riot Games API.
 * - A chave vai somente no cabeçalho X-Riot-Token (nunca na URL).
 * - Respeita o rate limit antes de enviar e o Retry-After ao receber HTTP 429.
 * - Repete falhas temporárias com espera exponencial, em número limitado de tentativas.
 */
export class RiotClient {
  private apiKey: string;
  private limiter: RateLimiter;
  private fetchImpl: FetchLike;
  private logger: Logger;
  private clock: Clock;
  private maxRetries: number;
  private timeoutMs: number;
  /** Total de chamadas enviadas à Riot (diagnóstico e testes). */
  requestCount = 0;

  constructor(options: RiotClientOptions) {
    this.apiKey = options.apiKey;
    this.limiter = options.limiter;
    this.fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init));
    this.logger = options.logger ?? silentLogger;
    this.clock = options.clock ?? systemClock;
    this.maxRetries = options.maxRetries ?? 3;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  get hasKey(): boolean {
    return this.apiKey.length > 0;
  }

  async get<T>(host: string, path: string, options: RequestOptions = {}): Promise<T> {
    if (!this.hasKey) {
      throw new AppError('MISSING_API_KEY', 'O servidor está sem a chave da Riot API (RIOT_API_KEY).');
    }
    const maxWaitMs = options.maxWaitMs ?? 8000;
    const query = Object.entries(options.query ?? {})
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    const url = `https://${host}${path}${query ? `?${query}` : ''}`;
    let lastFailure = 'falha desconhecida';

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await this.limiter.acquire(host, maxWaitMs);
      } catch (e) {
        if (e instanceof RateLimitExceededError) throw rateLimited(e.retryAfterMs);
        throw e;
      }

      let res: Response;
      this.requestCount++;
      try {
        res = await this.fetchImpl(url, {
          headers: { 'X-Riot-Token': this.apiKey, Accept: 'application/json' },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (e) {
        lastFailure = e instanceof Error ? e.message : 'erro de rede';
        this.logger.warn('riot: falha de rede', { host, path, attempt, reason: lastFailure });
        if (attempt < this.maxRetries) await this.clock.sleep(backoff(attempt));
        continue;
      }

      const appLimit = parseRateLimits(res.headers.get('x-app-rate-limit'));
      if (appLimit.length) this.limiter.updateRules(appLimit);

      if (res.ok) return (await res.json()) as T;

      if (res.status === 404) throw new RiotNotFoundError(path);
      if (res.status === 400) throw new AppError('INVALID_PARAMS', 'A Riot recusou os parâmetros da consulta.');
      if (res.status === 401 || res.status === 403) {
        this.logger.error('riot: chave recusada', { host, path, status: res.status });
        throw new AppError('RIOT_AUTH', 'A chave da Riot API é inválida ou expirou. Gere uma nova chave e atualize o servidor.', {
          riotStatus: res.status,
        });
      }
      if (res.status === 429) {
        const header = Number(res.headers.get('retry-after'));
        const retryAfterMs = Number.isFinite(header) && header > 0 ? header * 1000 : DEFAULT_RETRY_AFTER_MS;
        this.limiter.penalize(host, retryAfterMs);
        this.logger.warn('riot: HTTP 429', { host, path, retryAfterMs, type: res.headers.get('x-rate-limit-type') });
        if (attempt >= this.maxRetries || retryAfterMs > maxWaitMs) throw rateLimited(retryAfterMs);
        // A próxima volta espera em limiter.acquire até o bloqueio terminar.
        continue;
      }

      // 5xx e demais: falha temporária.
      lastFailure = `HTTP ${res.status}`;
      this.logger.warn('riot: falha temporária', { host, path, attempt, status: res.status });
      if (attempt < this.maxRetries) await this.clock.sleep(backoff(attempt));
    }

    throw new AppError('RIOT_UNAVAILABLE', 'A API da Riot está indisponível no momento. Tente novamente em instantes.', {
      reason: lastFailure,
    });
  }
}

const backoff = (attempt: number) => 400 * 2 ** attempt;

function rateLimited(retryAfterMs: number): AppError {
  const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return new AppError('RATE_LIMITED', `Limite de requisições da Riot atingido. Tente novamente em ${retryAfterSec} s.`, { retryAfterSec });
}
