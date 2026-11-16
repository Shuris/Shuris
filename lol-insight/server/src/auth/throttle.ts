import type { DatabaseSync } from 'node:sqlite';

import { AppError } from '../errors.ts';

export interface Limit {
  max: number;
  windowMs: number;
}

/**
 * Contador de tentativas guardado no banco (sobrevive a reinícios). Usado para
 * login, códigos de e-mail, cadastro e pedidos de redefinição de senha.
 */
export class Throttle {
  constructor(
    private db: DatabaseSync,
    private now: () => number,
  ) {}

  count(key: string, windowMs: number): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM auth_throttle WHERE key = ? AND at > ?').get(key, this.now() - windowMs) as { n: number }).n;
  }

  /** Segundos até a próxima tentativa ser aceita (0 = liberado). */
  retryAfter(key: string, limit: Limit): number {
    const rows = this.db.prepare('SELECT at FROM auth_throttle WHERE key = ? AND at > ? ORDER BY at DESC LIMIT ?').all(key, this.now() - limit.windowMs, limit.max) as Array<{ at: number }>;
    if (rows.length < limit.max) return 0;
    return Math.max(1, Math.ceil((rows[rows.length - 1].at + limit.windowMs - this.now()) / 1000));
  }

  /** Lança TOO_MANY_ATTEMPTS se o limite já foi atingido. */
  check(key: string, limit: Limit, message: string): void {
    const wait = this.retryAfter(key, limit);
    if (wait > 0) throw new AppError('TOO_MANY_ATTEMPTS', `${message} Tente novamente em ${formatWait(wait)}.`, { retryAfterSec: wait });
  }

  hit(key: string): void {
    this.db.prepare('INSERT INTO auth_throttle (key, at) VALUES (?, ?)').run(key, this.now());
  }

  clear(key: string): void {
    this.db.prepare('DELETE FROM auth_throttle WHERE key = ?').run(key);
  }

  /** Limpeza periódica de registros antigos. */
  prune(olderThanMs = 86_400_000): void {
    this.db.prepare('DELETE FROM auth_throttle WHERE at < ?').run(this.now() - olderThanMs);
  }
}

function formatWait(sec: number): string {
  if (sec < 60) return `${sec} s`;
  const min = Math.ceil(sec / 60);
  return `${min} min`;
}
