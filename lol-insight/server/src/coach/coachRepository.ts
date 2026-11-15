import type { DatabaseSync } from 'node:sqlite';

import { emptyCoachState, type CoachState, type DiagnosisRecord, type PastPlan, type PredictionRecord, type QuizAttempt, type TrainingPlan } from '@/coach/types';
import type { Rank } from '@/types';

/** Persistência do treinador: progresso, respostas, diagnósticos, planos, previsões e metas. */
export class CoachRepository {
  constructor(private db: DatabaseSync) {}

  loadState(puuid: string): CoachState {
    const state = emptyCoachState();
    const all = (sql: string) => this.db.prepare(sql).all(puuid) as Array<Record<string, unknown>>;

    for (const r of all('SELECT * FROM lesson_progress WHERE puuid = ?')) {
      state.lessons[String(r.lesson_id)] = {
        lessonId: String(r.lesson_id),
        completedAt: r.completed_at === null ? null : Number(r.completed_at),
        bestScore: Number(r.best_score),
        attempts: [],
      };
    }
    for (const r of all('SELECT * FROM quiz_attempts WHERE puuid = ? ORDER BY at ASC')) {
      const attempt: QuizAttempt = { at: Number(r.at), correct: Number(r.correct), total: Number(r.total), durationSec: Number(r.duration_sec), answers: JSON.parse(String(r.answers)) };
      state.lessons[String(r.lesson_id)]?.attempts.push(attempt);
    }
    state.activityDays = all('SELECT day FROM training_activity WHERE puuid = ? ORDER BY day ASC').map((r) => String(r.day));
    state.diagnoses = all('SELECT data FROM diagnoses WHERE puuid = ? ORDER BY at ASC').map((r) => JSON.parse(String(r.data)) as DiagnosisRecord);
    state.predictions = all('SELECT data FROM rank_predictions WHERE puuid = ? ORDER BY at ASC').map((r) => JSON.parse(String(r.data)) as PredictionRecord);
    for (const r of all('SELECT active, data FROM training_plans WHERE puuid = ? ORDER BY created_at ASC')) {
      if (Number(r.active) === 1) state.plan = JSON.parse(String(r.data)) as TrainingPlan;
      else state.pastPlans.push(JSON.parse(String(r.data)) as PastPlan);
    }
    const goal = this.db.prepare('SELECT * FROM rank_goals WHERE puuid = ?').get(puuid) as Record<string, unknown> | undefined;
    if (goal) state.goal = { rank: { tier: String(goal.tier) as Rank['tier'], division: Number(goal.division) as Rank['division'], lp: Number(goal.lp) }, setAt: Number(goal.set_at) };
    return state;
  }

  /** Grava o estado inteiro. As chaves naturais tornam a operação idempotente. */
  saveState(puuid: string, state: CoachState): void {
    const run = (sql: string, ...args: Array<string | number | null>) => this.db.prepare(sql).run(...args);
    this.db.exec('BEGIN');
    try {
      for (const p of Object.values(state.lessons)) {
        run('INSERT OR REPLACE INTO lesson_progress (puuid, lesson_id, completed_at, best_score) VALUES (?, ?, ?, ?)', puuid, p.lessonId, p.completedAt, p.bestScore);
        for (const a of p.attempts) {
          run(
            'INSERT OR REPLACE INTO quiz_attempts (puuid, lesson_id, at, correct, total, duration_sec, answers) VALUES (?, ?, ?, ?, ?, ?, ?)',
            puuid, p.lessonId, a.at, a.correct, a.total, a.durationSec, JSON.stringify(a.answers),
          );
        }
      }
      for (const day of state.activityDays) run('INSERT OR IGNORE INTO training_activity (puuid, day) VALUES (?, ?)', puuid, day);
      for (const d of state.diagnoses) run('INSERT OR REPLACE INTO diagnoses (puuid, at, sample, data) VALUES (?, ?, ?, ?)', puuid, d.at, d.sample, JSON.stringify(d));
      for (const p of state.predictions) run('INSERT OR REPLACE INTO rank_predictions (puuid, at, data) VALUES (?, ?, ?)', puuid, p.at, JSON.stringify(p));

      for (const past of state.pastPlans) {
        run('INSERT OR REPLACE INTO training_plans (puuid, plan_id, created_at, focus, active, data) VALUES (?, ?, ?, ?, 0, ?)', puuid, past.id, past.createdAt, past.focus, JSON.stringify(past));
      }
      if (state.plan) {
        run('INSERT OR REPLACE INTO training_plans (puuid, plan_id, created_at, focus, active, data) VALUES (?, ?, ?, ?, 1, ?)', puuid, state.plan.id, state.plan.createdAt, state.plan.focus, JSON.stringify(state.plan));
      }

      if (state.goal) {
        run('INSERT OR REPLACE INTO rank_goals (puuid, tier, division, lp, set_at) VALUES (?, ?, ?, ?, ?)', puuid, state.goal.rank.tier, state.goal.rank.division, state.goal.rank.lp, state.goal.setAt);
      } else {
        run('DELETE FROM rank_goals WHERE puuid = ?', puuid);
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  counts(puuid: string) {
    const n = (table: string) => (this.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE puuid = ?`).get(puuid) as { n: number }).n;
    return { lessons: n('lesson_progress'), attempts: n('quiz_attempts'), diagnoses: n('diagnoses'), plans: n('training_plans'), predictions: n('rank_predictions'), goals: n('rank_goals') };
  }
}
