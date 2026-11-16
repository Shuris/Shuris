import type { DatabaseSync } from 'node:sqlite';

import { AppError } from '../errors.ts';

/**
 * Caderno de matchups: anotações do usuário sobre um confronto
 * (seu campeão × campeão adversário). Pertencem ao usuário, não à conta Riot,
 * e somem junto com a conta (ON DELETE CASCADE).
 */

export type Difficulty = 'facil' | 'equilibrado' | 'dificil';
export const DIFFICULTIES: Difficulty[] = ['facil', 'equilibrado', 'dificil'];

export interface MatchupNote {
  championId: string;
  opponentId: string;
  difficulty: Difficulty;
  note: string;
  updatedAt: number;
}

export const NOTE_MAX_CHARS = 1000;
export const NOTES_MAX_PER_USER = 500;
/** Chave de campeão do Data Dragon (ex.: "LeeSin", "MonkeyKing"). */
const CHAMPION_ID = /^[A-Za-z][A-Za-z0-9]{1,29}$/;

interface Row {
  champion_id: string;
  opponent_id: string;
  difficulty: Difficulty;
  note: string;
  updated_at: number;
}

const toNote = (r: Row): MatchupNote => ({ championId: r.champion_id, opponentId: r.opponent_id, difficulty: r.difficulty, note: r.note, updatedAt: r.updated_at });

export class MatchupNotesService {
  constructor(
    private db: DatabaseSync,
    private now: () => number = Date.now,
  ) {}

  list(userId: string): MatchupNote[] {
    const rows = this.db.prepare('SELECT champion_id, opponent_id, difficulty, note, updated_at FROM matchup_notes WHERE user_id = ? ORDER BY updated_at DESC').all(userId) as unknown as Row[];
    return rows.map(toNote);
  }

  save(userId: string, body: Record<string, unknown>): MatchupNote {
    const championId = String(body.championId ?? '');
    const opponentId = String(body.opponentId ?? '');
    const difficulty = body.difficulty as Difficulty;
    const note = typeof body.note === 'string' ? body.note.replace(/\r\n/g, '\n').trim() : '';
    if (!CHAMPION_ID.test(championId) || !CHAMPION_ID.test(opponentId)) throw new AppError('INVALID_PARAMS', 'Campeão inválido.');
    if (championId === opponentId) throw new AppError('INVALID_PARAMS', 'Escolha dois campeões diferentes.');
    if (!DIFFICULTIES.includes(difficulty)) throw new AppError('INVALID_PARAMS', 'Dificuldade inválida.');
    if (note.length > NOTE_MAX_CHARS) throw new AppError('INVALID_PARAMS', `A anotação pode ter até ${NOTE_MAX_CHARS} caracteres.`);
    const exists = this.db.prepare('SELECT 1 FROM matchup_notes WHERE user_id = ? AND champion_id = ? AND opponent_id = ?').get(userId, championId, opponentId);
    if (!exists) {
      const n = (this.db.prepare('SELECT COUNT(*) AS n FROM matchup_notes WHERE user_id = ?').get(userId) as { n: number }).n;
      if (n >= NOTES_MAX_PER_USER) throw new AppError('INVALID_PARAMS', `Limite de ${NOTES_MAX_PER_USER} anotações atingido. Apague alguma para criar outra.`);
    }
    const t = this.now();
    this.db
      .prepare(
        `INSERT INTO matchup_notes (user_id, champion_id, opponent_id, difficulty, note, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, champion_id, opponent_id) DO UPDATE SET difficulty = excluded.difficulty, note = excluded.note, updated_at = excluded.updated_at`,
      )
      .run(userId, championId, opponentId, difficulty, note, t);
    return { championId, opponentId, difficulty, note, updatedAt: t };
  }

  remove(userId: string, championId: string, opponentId: string): void {
    const r = this.db.prepare('DELETE FROM matchup_notes WHERE user_id = ? AND champion_id = ? AND opponent_id = ?').run(userId, championId, opponentId);
    // Mesma resposta para "não existe" e "é de outro usuário": não revela nada.
    if (Number(r.changes) === 0) throw new AppError('NOT_FOUND', 'Anotação não encontrada.');
  }
}
