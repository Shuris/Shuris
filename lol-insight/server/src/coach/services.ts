import { diagnose } from '@/coach/diagnosis';
import { buildCoachReport, recordQuizAttempt, setGoal, setPlanDay, type QuizResult } from '@/coach/engine';
import { lessonById, LESSONS } from '@/coach/lessons';
import { estimateLpPerGame, type LpEstimate } from '@/coach/lpHistory';
import { predict } from '@/coach/prediction';
import type { CoachReport, CoachState, Diagnosis, DiagnosisRecord, Lesson, PredictionRecord } from '@/coach/types';
import type { Match, PlayerBundle, Rank, RankSnapshot } from '@/types';

import type { Repositories } from '../db/repositories.ts';
import { AppError } from '../errors.ts';
import type { AccountService } from '../services/accountService.ts';
import type { CoachRepository } from './coachRepository.ts';

/**
 * Serviços do treinador. Os cálculos ficam no motor compartilhado (src/coach),
 * que roda aqui no backend para as contas reais; cada serviço cuida de uma
 * responsabilidade e da sua persistência.
 */

/** Catálogo de aulas e correção dos testes (o gabarito fica no servidor). */
export class LessonService {
  list(): Lesson[] {
    return LESSONS;
  }

  get(id: string): Lesson {
    const lesson = lessonById(id);
    if (!lesson) throw new AppError('NOT_FOUND', 'Aula não encontrada.');
    return lesson;
  }

  /** Valida o formato das respostas de um teste. */
  checkAnswers(lessonId: string, answers: unknown): number[] {
    const lesson = this.get(lessonId);
    if (!Array.isArray(answers) || answers.length !== lesson.quiz.length || answers.some((a) => !Number.isInteger(a) || a < 0 || a > 9)) {
      throw new AppError('INVALID_PARAMS', `Envie uma resposta para cada uma das ${lesson.quiz.length} perguntas.`);
    }
    return answers as number[];
  }
}

/** Histórico de elo e LP (snapshots) e a estimativa de LP por partida derivada dele. */
export class LPHistoryService {
  constructor(private repos: Repositories) {}

  history(puuid: string): RankSnapshot[] {
    return this.repos.snapshots(puuid);
  }

  estimate(puuid: string, matches: Match[]): LpEstimate {
    return estimateLpPerGame(matches, this.history(puuid));
  }
}

/** Diagnóstico das dificuldades do jogador e o histórico de diagnósticos. */
export class PlayerDiagnosisService {
  constructor(private store: CoachRepository) {}

  diagnose(matches: Match[], now: number): Diagnosis {
    return diagnose(matches, now);
  }

  history(puuid: string): DiagnosisRecord[] {
    return this.store.loadState(puuid).diagnoses;
  }
}

/** Plano semanal: marcação dos dias. A criação e a renovação acontecem no ciclo do relatório. */
export class TrainingPlanService {
  setDay(state: CoachState, day: unknown, done: unknown, now: number): CoachState {
    if (!Number.isInteger(day) || (day as number) < 1 || (day as number) > 7 || typeof done !== 'boolean') {
      throw new AppError('INVALID_PARAMS', 'Informe o dia do plano (1 a 7) e se foi concluído.');
    }
    if (!state.plan) throw new AppError('NOT_FOUND', 'Não há plano de treinamento ativo.');
    return setPlanDay(state, day as number, done, now);
  }
}

const TIERS = ['FERRO', 'BRONZE', 'PRATA', 'OURO', 'PLATINA', 'ESMERALDA', 'DIAMANTE', 'MESTRE'];

/** Previsão de elo, metas e histórico de previsões. */
export class RankPredictionService {
  constructor(
    private store: CoachRepository,
    private lp: LPHistoryService,
  ) {}

  /** Previsão avulsa para um conjunto de partidas (sem gravar nada). */
  predict(bundle: PlayerBundle, puuid: string, goal: Rank | null = null) {
    return predict({ rank: bundle.player.rank, matches: bundle.matches, rankHistory: this.lp.history(puuid), asOf: bundle.asOf, goal });
  }

  history(puuid: string): PredictionRecord[] {
    return this.store.loadState(puuid).predictions;
  }

  /** Valida a meta enviada pelo app: uma liga com divisão, ou `null` para remover. */
  parseGoal(value: unknown): Rank | null {
    if (value === null) return null;
    const v = value as { tier?: unknown; division?: unknown } | undefined;
    if (!v || typeof v.tier !== 'string' || !TIERS.includes(v.tier) || !Number.isInteger(v.division) || (v.division as number) < 1 || (v.division as number) > 4) {
      throw new AppError('INVALID_PARAMS', 'Meta inválida: informe a liga e a divisão (1 a 4).');
    }
    return { tier: v.tier as Rank['tier'], division: (v.tier === 'MESTRE' ? 1 : v.division) as Rank['division'], lp: 0 };
  }
}

/**
 * Orquestra o ciclo: partidas armazenadas → diagnóstico → aulas recomendadas →
 * plano semanal → previsão. Cada chamada relê o estado, recalcula e grava.
 */
export class AcademyService {
  constructor(
    private accounts: AccountService,
    private store: CoachRepository,
    private lessons: LessonService,
    private plans: TrainingPlanService,
    private predictions: RankPredictionService,
    private lp: LPHistoryService,
    private now: () => number = Date.now,
  ) {}

  private async build(puuid: string, count: number, state: CoachState): Promise<CoachReport> {
    const bundle = await this.accounts.getStoredBundle(puuid, count);
    const now = this.now();
    const result = buildCoachReport({ player: bundle.player, matches: bundle.matches, rankHistory: this.lp.history(puuid), source: 'riot', asOf: bundle.asOf, now }, state);
    this.store.saveState(puuid, result.state);
    return result.report;
  }

  report(puuid: string, count: number): Promise<CoachReport> {
    return this.build(puuid, count, this.store.loadState(puuid));
  }

  async submitAttempt(puuid: string, count: number, lessonId: string, answers: unknown, durationSec: unknown): Promise<{ result: QuizResult; report: CoachReport }> {
    const checked = this.lessons.checkAnswers(lessonId, answers);
    const duration = typeof durationSec === 'number' && Number.isFinite(durationSec) ? Math.min(7200, Math.max(0, durationSec)) : 0;
    const { state, result } = recordQuizAttempt(this.store.loadState(puuid), lessonId, checked, duration, this.now());
    return { result, report: await this.build(puuid, count, state) };
  }

  setGoal(puuid: string, count: number, goal: unknown): Promise<CoachReport> {
    return this.build(puuid, count, setGoal(this.store.loadState(puuid), this.predictions.parseGoal(goal), this.now()));
  }

  setPlanDay(puuid: string, count: number, day: unknown, done: unknown): Promise<CoachReport> {
    return this.build(puuid, count, this.plans.setDay(this.store.loadState(puuid), day, done, this.now()));
  }
}
