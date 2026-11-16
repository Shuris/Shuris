import type { DatabaseSync } from 'node:sqlite';

import { attemptKey, dayOf, grade } from '@/challenge/engine';
import type { ChallengeAttempt } from '@/challenge/types';

import { AppError } from '../errors.ts';

/**
 * LOL Challenge das contas reais. O servidor corrige a resposta (o app nunca
 * informa se acertou), grava só a primeira tentativa de cada desafio (o diário
 * vale uma vez por dia) e monta o ranking apenas com quem aceitou participar.
 */
export interface RankingEntry {
  position: number;
  username: string;
  xp: number;
  solved: number;
  you: boolean;
}

const MAX_TZ = 14 * 60;

export class ChallengeService {
  constructor(
    private db: DatabaseSync,
    private now: () => number = Date.now,
  ) {}

  private tz(v: unknown): number {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n) || Math.abs(n) > MAX_TZ) throw new AppError('INVALID_PARAMS', 'Fuso horário inválido.');
    return Math.round(n);
  }

  attempts(userId: string): ChallengeAttempt[] {
    const rows = this.db.prepare('SELECT progress FROM challenge_progress WHERE user_id = ? ORDER BY completed_at').all(userId) as Array<{ progress: string }>;
    return rows.map((r) => JSON.parse(r.progress) as ChallengeAttempt);
  }

  optedIn(userId: string): boolean {
    const r = this.db.prepare('SELECT ranking_opt_in FROM challenge_profile WHERE user_id = ?').get(userId) as { ranking_opt_in: number } | undefined;
    return !!r?.ranking_opt_in;
  }

  state(userId: string, tzOffsetMin: unknown) {
    const tz = this.tz(tzOffsetMin);
    return { today: dayOf(this.now(), tz), attempts: this.attempts(userId), rankingOptIn: this.optedIn(userId) };
  }

  submit(userId: string, body: Record<string, unknown>) {
    const tz = this.tz(body.tzOffsetMin);
    const now = this.now();
    const day = dayOf(now, tz);
    let attempt: ChallengeAttempt;
    try {
      attempt = grade(String(body.challengeId ?? ''), Number(body.answer), now, day, body.daily === true);
    } catch (e) {
      const code = (e as Error).message;
      throw new AppError(code === 'UNKNOWN_CHALLENGE' ? 'NOT_FOUND' : 'INVALID_PARAMS', code === 'NOT_TODAYS_DAILY' ? 'Este não é o desafio diário de hoje.' : code === 'UNKNOWN_CHALLENGE' ? 'Desafio não encontrado.' : 'Resposta inválida.');
    }
    const key = attemptKey(attempt);
    const existing = this.db.prepare('SELECT progress FROM challenge_progress WHERE user_id = ? AND challenge_id = ?').get(userId, key) as { progress: string } | undefined;
    if (existing) return { attempt: JSON.parse(existing.progress) as ChallengeAttempt, alreadyAnswered: true };
    this.db
      .prepare('INSERT INTO challenge_progress (user_id, challenge_id, status, progress, started_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(userId, key, attempt.correct ? 'completed' : 'failed', JSON.stringify(attempt), now, now, now);
    return { attempt, alreadyAnswered: false };
  }

  setOptIn(userId: string, optIn: unknown) {
    if (typeof optIn !== 'boolean') throw new AppError('INVALID_PARAMS', 'Informe se deseja participar do ranking.');
    this.db
      .prepare('INSERT INTO challenge_profile (user_id, ranking_opt_in, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET ranking_opt_in = excluded.ranking_opt_in, updated_at = excluded.updated_at')
      .run(userId, optIn ? 1 : 0, this.now());
    return { rankingOptIn: optIn };
  }

  /** Top N por XP entre quem aceitou aparecer. Só o nome de usuário é exibido. */
  ranking(userId: string, limit = 20): { entries: RankingEntry[]; optedIn: boolean; you: RankingEntry | null } {
    const rows = this.db
      .prepare(
        `SELECT u.id AS id, u.username AS username,
                COALESCE(SUM(json_extract(cp.progress, '$.xp')), 0) AS xp,
                COALESCE(SUM(CASE WHEN cp.status = 'completed' THEN 1 ELSE 0 END), 0) AS solved
         FROM challenge_profile p
         JOIN users u ON u.id = p.user_id
         LEFT JOIN challenge_progress cp ON cp.user_id = p.user_id
         WHERE p.ranking_opt_in = 1
         GROUP BY u.id
         ORDER BY xp DESC, solved DESC, u.username ASC`,
      )
      .all() as Array<{ id: string; username: string; xp: number; solved: number }>;
    const all = rows.map((r, i) => ({ position: i + 1, username: r.username, xp: Number(r.xp), solved: Number(r.solved), you: r.id === userId }));
    return { entries: all.slice(0, limit), optedIn: this.optedIn(userId), you: all.find((e) => e.you) ?? null };
  }
}
