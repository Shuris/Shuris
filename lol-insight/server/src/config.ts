import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { STANDARD_PARAMS, type HashParams } from './auth/password.ts';
import type { RsoConfig } from './auth/rso.ts';

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
  /** Segredo do servidor (HMAC dos códigos e chave dos tokens do RSO). Nunca vai para o app. */
  authSecret: Buffer;
  passwordParams: HashParams;
  /** Transporte de e-mail. Só "console" (desenvolvimento) existe hoje; um provedor real é serviço externo. */
  mailTransport: 'console';
  rso: RsoConfig | null;
  /** Origens da versão web autorizadas (CORS). Padrão: qualquer uma, para desenvolvimento. */
  allowedOrigins: string[];
  /** true quando o servidor fica atrás de um proxy HTTPS que preenche X-Forwarded-For. */
  trustProxy: boolean;
  /** Uso pessoal sem conta: requisições locais sem token usam um usuário único. Desligado por padrão. */
  personalMode: boolean;
}

/**
 * Segredo do servidor: AUTH_SECRET (≥ 32 caracteres) ou um arquivo gerado
 * automaticamente ao lado do banco, com permissão só para o dono.
 */
export function loadAuthSecret(env: NodeJS.ProcessEnv, databaseFile: string): Buffer {
  const fromEnv = (env.AUTH_SECRET ?? '').trim();
  if (fromEnv) {
    if (fromEnv.length < 32) throw new Error('AUTH_SECRET precisa ter pelo menos 32 caracteres.');
    return Buffer.from(fromEnv, 'utf8');
  }
  if (databaseFile === ':memory:') return randomBytes(32);
  const file = resolve(dirname(databaseFile), 'auth-secret');
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, randomBytes(32).toString('base64url'), { mode: 0o600 });
  }
  try {
    chmodSync(file, 0o600);
  } catch {
    // Em alguns sistemas (Windows) a permissão não se aplica; o arquivo continua fora do Git (pasta data/).
  }
  return Buffer.from(readFileSync(file, 'utf8').trim(), 'utf8');
}

function loadRso(env: NodeJS.ProcessEnv): RsoConfig | null {
  const clientId = (env.RSO_CLIENT_ID ?? '').trim();
  const clientSecret = (env.RSO_CLIENT_SECRET ?? '').trim();
  const redirectUri = (env.RSO_REDIRECT_URI ?? '').trim();
  const issuer = (env.RSO_ISSUER ?? '').trim();
  const accountUrl = (env.RSO_ACCOUNT_URL ?? '').trim();
  return clientId && clientSecret && redirectUri && issuer && accountUrl ? { clientId, clientSecret, redirectUri, issuer, accountUrl } : null;
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
    authSecret: loadAuthSecret(env, env.DATABASE_FILE || './data/lolinsight.db'),
    passwordParams: STANDARD_PARAMS,
    mailTransport: 'console',
    rso: loadRso(env),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '*').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean),
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
    personalMode: env.PERSONAL_MODE === '1' || env.PERSONAL_MODE === 'true',
  };
}
