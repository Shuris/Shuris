import type { RateLimitRule } from '../config.ts';

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export class RateLimitExceededError extends Error {
  constructor(readonly retryAfterMs: number) {
    super(`Limite de requisições atingido; aguarde ${Math.ceil(retryAfterMs / 1000)} s`);
    this.name = 'RateLimitExceededError';
  }
}

interface Bucket {
  /** Instantes das requisições recentes (ordem crescente). */
  stamps: number[];
  /** Bloqueio imposto por um HTTP 429 (Retry-After). */
  blockedUntil: number;
}

/**
 * Controle de requisições por janela deslizante.
 *
 * Os limites da Riot valem por região de roteamento, então há um balde por
 * host. Antes de cada chamada o cliente pede uma vaga (`acquire`); se não
 * houver, espera o necessário — ou falha de imediato quando a espera passaria
 * do máximo aceito por quem chamou.
 */
export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private rules: RateLimitRule[];
  /** Margem para absorver diferença de relógio com os servidores da Riot. */
  private readonly marginMs = 60;

  constructor(
    rules: RateLimitRule[],
    private clock: Clock = systemClock,
  ) {
    this.rules = [...rules];
  }

  private bucket(key: string): Bucket {
    let b = this.buckets.get(key);
    if (!b) {
      b = { stamps: [], blockedUntil: 0 };
      this.buckets.set(key, b);
    }
    return b;
  }

  /** Quanto falta (ms) para a próxima vaga neste host. 0 = pode enviar agora. */
  waitTime(key: string): number {
    const now = this.clock.now();
    const b = this.bucket(key);
    const longest = Math.max(...this.rules.map((r) => r.windowMs), 0);
    while (b.stamps.length && b.stamps[0] <= now - longest) b.stamps.shift();
    let wait = Math.max(0, b.blockedUntil - now);
    for (const rule of this.rules) {
      const inWindow = b.stamps.filter((t) => t > now - rule.windowMs);
      if (inWindow.length >= rule.max) {
        const oldestThatMustExpire = inWindow[inWindow.length - rule.max];
        wait = Math.max(wait, oldestThatMustExpire + rule.windowMs - now + this.marginMs);
      }
    }
    return wait;
  }

  /** Reserva uma vaga, esperando se preciso. Lança RateLimitExceededError se a espera exceder `maxWaitMs`. */
  async acquire(key: string, maxWaitMs: number): Promise<void> {
    let waited = 0;
    for (;;) {
      const wait = this.waitTime(key);
      if (wait <= 0) {
        this.bucket(key).stamps.push(this.clock.now());
        return;
      }
      if (waited + wait > maxWaitMs) throw new RateLimitExceededError(wait);
      await this.clock.sleep(wait);
      waited += wait;
    }
  }

  /** Aplica o tempo de espera informado pela Riot em um HTTP 429. */
  penalize(key: string, retryAfterMs: number): void {
    const b = this.bucket(key);
    b.blockedUntil = Math.max(b.blockedUntil, this.clock.now() + retryAfterMs);
  }

  /** Adota os limites reais da chave, informados no cabeçalho X-App-Rate-Limit. */
  updateRules(rules: RateLimitRule[]): void {
    if (rules.length) this.rules = [...rules];
  }

  getRules(): RateLimitRule[] {
    return [...this.rules];
  }
}
