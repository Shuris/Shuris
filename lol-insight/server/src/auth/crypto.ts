import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** Identificadores e tokens aleatórios (CSPRNG). */
export const newId = (prefix: string) => `${prefix}_${randomBytes(12).toString('hex')}`;
export const newToken = () => randomBytes(32).toString('base64url');
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Código numérico de 6 dígitos para e-mail (verificação e redefinição). */
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/**
 * Códigos têm pouca entropia, então nunca são guardados em claro nem com hash
 * simples: usa-se HMAC com o segredo do servidor, amarrado ao ID do token.
 */
export function hashCode(secret: Buffer, tokenId: string, code: string): string {
  return createHmac('sha256', secret).update(`${tokenId}:${code}`).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/**
 * Criptografia autenticada (AES-256-GCM) para segredos que precisam ser lidos
 * de volta — os tokens do RSO, quando a integração for aprovada.
 * A chave é derivada do segredo do servidor com HKDF; o formato é v1.iv.tag.dados.
 */
export class TokenCipher {
  private key: Buffer;

  constructor(secret: Buffer) {
    this.key = Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), 'lolinsight:rso-tokens:v1', 32));
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
  }

  decrypt(sealed: string): string {
    const [version, iv, tag, data] = sealed.split('.');
    if (version !== 'v1' || !iv || !tag || data === undefined) throw new Error('Formato de token criptografado inválido');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  }
}
