import { rankToAbsolute } from '@/stats/rank';
import type { DataSourceKind, Match, Player, Rank, RankSnapshot } from '@/types';

import { dayKey, lessonsFor, summarizeAcademy } from './academy';
import { diagnose } from './diagnosis';
import { lessonById, PASS_SCORE } from './lessons';
import { predict } from './prediction';
import { ensurePlan } from './trainingPlan';
import type { CoachReport, CoachState, DiagnosisRecord, PredictionRecord, QuizAttempt } from './types';

export interface CoachInput {
  player: Player;
  matches: Match[];
  rankHistory: RankSnapshot[];
  source: DataSourceKind;
  /** Instante de referência dos dados (o "agora" das partidas). */
  asOf: number;
  /** Relógio real, usado para o plano semanal e a sequência de treino. */
  now: number;
}

const HISTORY_LIMIT = 30;
const ATTEMPT_LIMIT = 10;

/**
 * Ciclo do treinador: estatísticas → diagnóstico → aulas → plano → previsão.
 * Função pura: recebe as partidas e o estado salvo, devolve o relatório e o
 * estado atualizado (diagnóstico e previsão registrados, plano renovado).
 */
export function buildCoachReport(input: CoachInput, previous: CoachState): { report: CoachReport; state: CoachState } {
  let state = previous;
  const diagnosis = diagnose(input.matches, input.asOf, input.player.rank);

  // Registra o diagnóstico quando algo mudou (novas partidas ou outra lista de pontos fracos).
  const lastD = state.diagnoses[state.diagnoses.length - 1];
  const signature = (d: DiagnosisRecord) => `${d.sample}|${d.skills.map((s) => `${s.skill}:${s.status}`).join(',')}`;
  const record: DiagnosisRecord = {
    at: input.now,
    sample: diagnosis.sample,
    skills: diagnosis.skills.map((s) => ({ skill: s.skill, status: s.status, severity: s.severity, practice: s.practice, value: s.value })),
  };
  if (diagnosis.enough && (!lastD || signature(lastD) !== signature(record))) state = { ...state, diagnoses: [...state.diagnoses, record].slice(-HISTORY_LIMIT) };

  state = ensurePlan(state, diagnosis, input.matches, input.now);

  const { prediction, goal } = predict({
    rank: input.player.rank,
    matches: input.matches,
    rankHistory: input.rankHistory,
    asOf: input.asOf,
    goal: state.goal?.rank ?? null,
    diagnosis,
    lessonsFor: (skill) => lessonsFor(state, skill),
  });

  // Registra a previsão quando os dados de entrada mudaram (novas partidas ou outro elo).
  if (prediction.status === 'ok' && prediction.inputs && prediction.currentAbs !== null) {
    const lastP = state.predictions[state.predictions.length - 1];
    if (!lastP || lastP.rankedGames !== prediction.inputs.rankedGames || lastP.currentAbs !== prediction.currentAbs) {
      const rec: PredictionRecord = {
        at: input.now,
        currentAbs: prediction.currentAbs,
        rankedGames: prediction.inputs.rankedGames,
        winRate: prediction.inputs.smoothedWinRate,
        gamesPerWeek: prediction.inputs.gamesPerWeek,
        horizons: prediction.horizons.map((h) => ({ days: h.days, low: h.low, central: h.central, high: h.high })),
      };
      state = { ...state, predictions: [...state.predictions, rec].slice(-HISTORY_LIMIT) };
    }
  }

  const currentAbs = input.player.rank ? rankToAbsolute(input.player.rank) : null;
  const report: CoachReport = {
    generatedAt: input.now,
    source: input.source,
    playerName: input.player.gameName,
    academy: summarizeAcademy(state, diagnosis, input.matches, goal, currentAbs, input.now),
    diagnosis,
    plan: state.plan,
    pastPlans: state.pastPlans,
    prediction,
    goal,
    progress: state.lessons,
    predictionHistory: state.predictions,
  };
  return { report, state };
}

const markActive = (state: CoachState, now: number): CoachState => {
  const key = dayKey(now);
  return state.activityDays.includes(key) ? state : { ...state, activityDays: [...state.activityDays, key].slice(-120) };
};

export interface QuizResult {
  correct: number;
  total: number;
  score: number;
  passed: boolean;
}

/** Corrige um teste e registra a tentativa. A aula é concluída ao atingir o aproveitamento mínimo. */
export function recordQuizAttempt(state: CoachState, lessonId: string, answers: number[], durationSec: number, now: number): { state: CoachState; result: QuizResult } {
  const lesson = lessonById(lessonId);
  if (!lesson) throw new Error(`Aula desconhecida: ${lessonId}`);
  const total = lesson.quiz.length;
  const correct = lesson.quiz.reduce((n, q, i) => n + (answers[i] === q.correct ? 1 : 0), 0);
  const score = correct / total;
  const passed = score >= PASS_SCORE;
  const attempt: QuizAttempt = { at: now, correct, total, durationSec: Math.max(0, Math.round(durationSec)), answers: answers.slice(0, total) };
  const prev = state.lessons[lessonId];
  const next = {
    lessonId,
    completedAt: prev?.completedAt ?? (passed ? now : null),
    bestScore: Math.max(prev?.bestScore ?? 0, score),
    attempts: [...(prev?.attempts ?? []), attempt].slice(-ATTEMPT_LIMIT),
  };
  return { state: markActive({ ...state, lessons: { ...state.lessons, [lessonId]: next } }, now), result: { correct, total, score, passed } };
}

export function setGoal(state: CoachState, rank: Rank | null, now: number): CoachState {
  return { ...state, goal: rank ? { rank, setAt: now } : null };
}

/** Marca ou desmarca um dia do plano semanal. */
export function setPlanDay(state: CoachState, day: number, done: boolean, now: number): CoachState {
  if (!state.plan) return state;
  const days = state.plan.days.map((d) => (d.day === day ? { ...d, done, doneAt: done ? now : undefined } : d));
  const next = { ...state, plan: { ...state.plan, days } };
  return done ? markActive(next, now) : next;
}
