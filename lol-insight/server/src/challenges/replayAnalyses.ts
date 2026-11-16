import type { DatabaseSync } from 'node:sqlite';

import { newId } from '../auth/crypto.ts';
import { AppError } from '../errors.ts';

/**
 * Histórico do Replay Challenge (decisões em momentos reais das partidas).
 * Guarda as respostas do próprio usuário; não há ranking com esses dados.
 */
export interface ReplayAnalysis {
  matchId: string;
  at: number;
  championId: string;
  answers: Array<{ momentId: string; correct: boolean }>;
  score: number;
}

const MATCH_ID = /^[A-Z0-9]{2,5}_\d{5,}$/;
const SAFE = /^[\w-]{1,60}$/;

export class ReplayAnalysisService {
  constructor(
    private db: DatabaseSync,
    private now: () => number = Date.now,
  ) {}

  list(userId: string): ReplayAnalysis[] {
    const rows = this.db.prepare('SELECT data FROM replay_analyses WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100').all(userId) as Array<{ data: string }>;
    return rows.map((r) => JSON.parse(r.data) as ReplayAnalysis);
  }

  save(userId: string, body: Record<string, unknown>): ReplayAnalysis {
    const matchId = String(body.matchId ?? '');
    const championId = String(body.championId ?? '');
    const answers = Array.isArray(body.answers) ? body.answers : [];
    if (!MATCH_ID.test(matchId) || !SAFE.test(championId)) throw new AppError('INVALID_PARAMS', 'Partida inválida.');
    if (answers.length < 1 || answers.length > 12) throw new AppError('INVALID_PARAMS', 'Respostas inválidas.');
    const clean = answers.map((a) => {
      const r = a as { momentId?: unknown; correct?: unknown };
      if (typeof r.momentId !== 'string' || !SAFE.test(r.momentId) || typeof r.correct !== 'boolean') throw new AppError('INVALID_PARAMS', 'Respostas inválidas.');
      return { momentId: r.momentId, correct: r.correct };
    });
    const t = this.now();
    const record: ReplayAnalysis = { matchId, at: t, championId, answers: clean, score: clean.filter((a) => a.correct).length / clean.length };
    this.db
      .prepare(
        `INSERT INTO replay_analyses (id, user_id, match_id, puuid, data, created_at, updated_at) VALUES (?, ?, ?, '', ?, ?, ?)
         ON CONFLICT(user_id, match_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      )
      .run(newId('rpa'), userId, matchId, JSON.stringify(record), t, t);
    return record;
  }
}
