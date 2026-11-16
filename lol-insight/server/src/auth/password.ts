import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

import { AppError } from '../errors.ts';

/**
 * Hash de senha com scrypt (função lenta e com uso intenso de memória, nativa do Node).
 *
 * Parâmetros padrão: N = 2^15, r = 8, p = 3 — uma das configurações recomendadas
 * pela OWASP para scrypt (≈ 32 MiB por cálculo). O formato guarda algoritmo,
 * parâmetros, sal e hash, então os parâmetros podem subir no futuro: quem fizer
 * login com um hash antigo tem a senha re-hasheada automaticamente.
 *
 *   scrypt$<log2 N>$<r>$<p>$<sal base64url>$<hash base64url>
 */

export interface HashParams {
  logN: number;
  r: number;
  p: number;
}

export const STANDARD_PARAMS: HashParams = { logN: 15, r: 8, p: 3 };
/** Apenas para testes automatizados: rápido e inseguro. Nunca usar em produção. */
export const TEST_PARAMS: HashParams = { logN: 10, r: 8, p: 1 };

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

function derive(password: string, salt: Buffer, p: HashParams): Promise<Buffer> {
  const N = 2 ** p.logN;
  const options: ScryptOptions = { N, r: p.r, p: p.p, maxmem: 128 * N * p.r * (p.p + 2) };
  return new Promise((resolve, reject) => scryptCb(password.normalize('NFKC'), salt, KEY_LENGTH, options, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(password: string, params: HashParams = STANDARD_PARAMS): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, params);
  return ['scrypt', params.logN, params.r, params.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

function parse(stored: string): { params: HashParams; salt: Buffer; key: Buffer } | null {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [logN, r, p] = parts.slice(1, 4).map(Number);
  if (![logN, r, p].every((n) => Number.isInteger(n) && n > 0) || logN > 20) return null;
  return { params: { logN, r, p }, salt: Buffer.from(parts[4], 'base64url'), key: Buffer.from(parts[5], 'base64url') };
}

/** Comparação em tempo constante. Hash malformado nunca é aceito. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parse(stored);
  if (!parsed) return false;
  const key = await derive(password, parsed.salt, parsed.params);
  return key.length === parsed.key.length && timingSafeEqual(key, parsed.key);
}

export function needsRehash(stored: string, params: HashParams): boolean {
  const parsed = parse(stored);
  return !parsed || parsed.params.logN < params.logN || parsed.params.r < params.r || parsed.params.p < params.p;
}

// ---- Política de senha (linha NIST 800-63B: tamanho mínimo, sem regras de composição) ----

const COMMON = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1', 'senha123', 'senha1234', 'qwerty123', 'qwertyuiop', 'abc12345',
  '11111111', '00000000', '87654321', 'iloveyou', 'admin123', 'welcome1', 'letmein1', 'princess', 'sunshine', 'football',
  'baseball', 'dragon123', 'monkey123', 'leagueoflegends', 'lolinsight', 'riotgames', 'master123', 'aaaaaaaa', 'asdfghjk', 'zxcvbnm1',
]);

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export function assertPasswordPolicy(password: unknown, context: { email?: string; username?: string } = {}): string {
  if (typeof password !== 'string') throw new AppError('WEAK_PASSWORD', 'Informe uma senha.');
  if (password.length < PASSWORD_MIN) throw new AppError('WEAK_PASSWORD', `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`);
  if (password.length > PASSWORD_MAX) throw new AppError('WEAK_PASSWORD', `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`);
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) throw new AppError('WEAK_PASSWORD', 'Essa senha é muito comum. Escolha outra.');
  if ((context.email && lower === context.email.toLowerCase()) || (context.username && lower === context.username.toLowerCase())) {
    throw new AppError('WEAK_PASSWORD', 'A senha não pode ser igual ao e-mail ou ao nome de usuário.');
  }
  return password;
}
