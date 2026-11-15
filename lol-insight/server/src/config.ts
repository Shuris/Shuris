import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface RateLimitRule {
  max: number;
  windowMs: number;
}

export interface Config {
  riotApiKey: string;
  port: number;
  host: string;
  databaseFile: string;
  rateLimits: RateLimitRule[];
  ddragonLocale: string;
}

/** "20:1,100:120" → [{max:20, windowMs:1000}, {max:100, windowMs:120000}] */
export function parseRateLimits(value: string | undefined | null): RateLimitRule[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim().split(':').map(Number))
    .filter(([max, sec]) => Number.isFinite(max) && Number.isFinite(sec) && max > 0 && sec > 0)
    .map(([max, sec]) => ({ max, windowMs: sec * 1000 }));
}

/** Lê as variáveis de ambiente (carregando ".env" quando existir). A chave nunca sai deste processo. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): Config {
  const envFile = resolve(cwd, '.env');
  if (env === process.env && existsSync(envFile)) process.loadEnvFile(envFile);
  const limits = parseRateLimits(env.RIOT_RATE_LIMITS);
  return {
    riotApiKey: (env.RIOT_API_KEY ?? '').trim(),
    port: Number(env.PORT) || 3333,
    host: env.HOST || '0.0.0.0',
    databaseFile: env.DATABASE_FILE || './data/lolinsight.db',
    rateLimits: limits.length ? limits : parseRateLimits('20:1,100:120'),
    ddragonLocale: env.DDRAGON_LOCALE || 'pt_BR',
  };
}
