import type { DatabaseSync } from 'node:sqlite';

import { emptyCoachState, type CoachState, type DiagnosisRecord, type PastPlan, type PredictionRecord, type QuizAttempt, type TrainingPlan } from '@/coach/types';
import type { Rank } from '@/types';

/**
 * Persistência do treinador, sempre filtrada pelo usuário.
 * - Progresso nas aulas, testes, sequência de treino e plano: do usuário.
 * - Diagnósticos, previsões e meta de elo: do usuário + conta Riot analisada (puuid).
 */
export class CoachRepository {
  constructor(private db: DatabaseSync) {}

  loadState(userId: string, puuid: string): CoachState {
    const state = emptyCoachState();
    const byUser = (sql: string) => this.db.prepare(sql).all(userId) as Array<Record<string, unknown>>;
    const byAccount = (sql: string) => this.db.prepare(sql).all(userId, puuid) as Array<Record<string, unknown>>;

    for (const r of byUser('SELECT * FROM academy_progress WHERE user_id = ?')) {
      state.lessons[String(r.lesson_id)] = {
        lessonId: String(r.lesson_id),
        completedAt: r.completed_at === null ? null : Number(r.completed_at),
        bestScore: Number(r.best_score),
        attempts: [],
      };
    }
    for (const r of byUser('SELECT * FROM academy_quiz_attempts WHERE user_id = ? ORDER BY at ASC')) {
      const attempt: QuizAttempt = { at: Number(r.at), correct: Number(r.correct), total: Number(r.total), durationSec: Number(r.duration_sec), answers: JSON.parse(String(r.answers)) };
      state.lessons[String(r.lesson_id)]?.attempts.push(attempt);
    }
    state.activityDays = byUser('SELECT day FROM academy_activity WHERE user_id = ? ORDER BY day ASC').map((r) => String(r.day));
    for (const r of byUser('SELECT active, data FROM academy_plans WHERE user_id = ? ORDER BY created_at ASC')) {
      if (Number(r.active) === 1) state.plan = JSON.parse(String(r.data)) as TrainingPlan;
      else state.pastPlans.push(JSON.parse(String(r.data)) as PastPlan);
    }
    state.diagnoses = byAccount('SELECT data FROM academy_diagnoses WHERE user_id = ? AND puuid = ? ORDER BY at ASC').map((r) => JSON.parse(String(r.data)) as DiagnosisRecord);
    state.predictions = byAccount('SELECT data FROM rank_predictions WHERE user_id = ? AND puuid = ? ORDER BY at ASC').map((r) => JSON.parse(String(r.data)) as PredictionRecord);
    const goal = this.db.prepare('SELECT * FROM rank_goals WHERE user_id = ? AND puuid = ?').get(userId, puuid) as Record<string, unknown> | undefined;
    if (goal) state.goal = { rank: { tier: String(goal.tier) as Rank['tier'], division: Number(goal.division) as Rank['division'], lp: Number(goal.lp) }, setAt: Number(goal.set_at) };
    return state;
  }

  /** Grava o estado inteiro numa transação. As chaves naturais tornam a operação idempotente. */
  saveState(userId: string, puuid: string, state: CoachState): void {
    const run = (sql: string, ...args: Array<string | number | null>) => this.db.prepare(sql).run(...args);
    this.db.exec('BEGIN');
    try {
      for (const p of Object.values(state.lessons)) {
        run('INSERT OR REPLACE INTO academy_progress (user_id, lesson_id, completed_at, best_score) VALUES (?, ?, ?, ?)', userId, p.lessonId, p.completedAt, p.bestScore);
        for (const a of p.attempts) {
          run(
            'INSERT OR REPLACE INTO academy_quiz_attempts (user_id, lesson_id, at, correct, total, duration_sec, answers) VALUES (?, ?, ?, ?, ?, ?, ?)',
            userId, p.lessonId, a.at, a.correct, a.total, a.durationSec, JSON.stringify(a.answers),
          );
        }
      }
      for (const day of state.activityDays) run('INSERT OR IGNORE INTO academy_activity (user_id, day) VALUES (?, ?)', userId, day);
      for (const past of state.pastPlans) {
        run('INSERT OR REPLACE INTO academy_plans (user_id, plan_id, created_at, focus, active, data) VALUES (?, ?, ?, ?, 0, ?)', userId, past.id, past.createdAt, past.focus, JSON.stringify(past));
      }
      if (state.plan) {
        run('INSERT OR REPLACE INTO academy_plans (user_id, plan_id, created_at, focus, active, data) VALUES (?, ?, ?, ?, 1, ?)', userId, state.plan.id, state.plan.createdAt, state.plan.focus, JSON.stringify(state.plan));
      }
      for (const d of state.diagnoses) run('INSERT OR REPLACE INTO academy_diagnoses (user_id, puuid, at, sample, data) VALUES (?, ?, ?, ?, ?)', userId, puuid, d.at, d.sample, JSON.stringify(d));
      for (const p of state.predictions) run('INSERT OR REPLACE INTO rank_predictions (user_id, puuid, at, data) VALUES (?, ?, ?, ?)', userId, puuid, p.at, JSON.stringify(p));
      if (state.goal) {
        run(
          'INSERT OR REPLACE INTO rank_goals (user_id, puuid, tier, division, lp, set_at) VALUES (?, ?, ?, ?, ?, ?)',
          userId, puuid, state.goal.rank.tier, state.goal.rank.division, state.goal.rank.lp, state.goal.setAt,
        );
      } else {
        run('DELETE FROM rank_goals WHERE user_id = ? AND puuid = ?', userId, puuid);
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  counts(userId: string) {
    const n = (table: string) => (this.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).get(userId) as { n: number }).n;
    return {
      lessons: n('academy_progress'),
      attempts: n('academy_quiz_attempts'),
      diagnoses: n('academy_diagnoses'),
      plans: n('academy_plans'),
      predictions: n('rank_predictions'),
      goals: n('rank_goals'),
    };
  }
}
