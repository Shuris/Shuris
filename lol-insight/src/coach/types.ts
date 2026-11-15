import type { DataSourceKind, Rank } from '@/types';

/**
 * Modelos do "treinador": Academy (aulas, diagnóstico, plano) e Rank Predictor.
 * Compartilhados entre o app e o backend.
 */

/** Habilidades acompanhadas. Cada aula ensina uma ou mais; o diagnóstico mede cada uma nas partidas. */
export type SkillId = 'FARM' | 'LANE' | 'VISION' | 'OBJECTIVES' | 'CLOSING' | 'TEAMFIGHT' | 'MENTAL' | 'POOL';
export type CategoryId = 'fundamentos' | 'rotas' | 'combate' | 'macro' | 'mentalidade';

// ---- Aulas ---------------------------------------------------------------------

export interface QuizQuestion {
  question: string;
  options: string[];
  /** Índice da alternativa correta. */
  correct: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  category: CategoryId;
  /** 1 = básico, 2 = intermediário, 3 = avançado. */
  level: 1 | 2 | 3;
  minutes: number;
  skills: SkillId[];
  objective: string;
  theory: Array<{ title: string; text: string }>;
  examples: string[];
  mistakes: string[];
  apply: string[];
  exercise: { title: string; steps: string[]; success: string };
  quiz: QuizQuestion[];
}

// ---- Progresso -----------------------------------------------------------------

export interface QuizAttempt {
  at: number;
  correct: number;
  total: number;
  durationSec: number;
  answers: number[];
}

export interface LessonProgress {
  lessonId: string;
  /** Primeira vez em que o teste foi concluído com aproveitamento mínimo. */
  completedAt: number | null;
  /** Melhor aproveitamento no teste (0–1). */
  bestScore: number;
  attempts: QuizAttempt[];
}

// ---- Diagnóstico ---------------------------------------------------------------

export type SkillStatus = 'weakness' | 'ok' | 'strength' | 'insufficient';

export interface SkillDiagnosis {
  skill: SkillId;
  status: SkillStatus;
  /** 0–100; quanto maior, mais prioritária a correção (só para pontos fracos). */
  severity: number;
  /** Desempenho prático medido nas partidas, 0–100 (50 = referência da posição). `null` sem amostra. */
  practice: number | null;
  sample: number;
  minSample: number;
  metricLabel: string;
  /** Valor numérico da métrica principal (para metas do plano). */
  value: number | null;
  display: string;
  reference: string;
  higherIsBetter: boolean;
  /** Comparação do jogador consigo mesmo: partidas recentes vs anteriores. */
  trend: 'up' | 'down' | 'flat' | null;
  evidence: string;
}

export interface Diagnosis {
  at: number;
  sample: number;
  /** false quando não há partidas suficientes para qualquer conclusão. */
  enough: boolean;
  skills: SkillDiagnosis[];
  /** Pontos fracos, do mais para o menos prioritário. */
  weaknesses: SkillId[];
  note?: string;
}

export interface DiagnosisRecord {
  at: number;
  sample: number;
  skills: Array<{ skill: SkillId; status: SkillStatus; severity: number; practice: number | null; value: number | null }>;
}

// ---- Plano de treinamento -------------------------------------------------------

export type PlanDayKind = 'lesson' | 'exercise' | 'apply' | 'review' | 'evaluate';

export interface PlanDay {
  day: number;
  kind: PlanDayKind;
  title: string;
  description: string;
  lessonId?: string;
  done: boolean;
  doneAt?: number;
}

export interface PlanEvaluation {
  matchesSince: number;
  current: number | null;
  currentDisplay: string;
  verdict: 'improved' | 'same' | 'worse' | 'insufficient';
  text: string;
}

export interface TrainingPlan {
  id: string;
  createdAt: number;
  /** Número da semana de treino (1, 2, 3...). */
  sequence: number;
  focus: SkillId;
  title: string;
  objective: string;
  metricLabel: string;
  baseline: number | null;
  baselineDisplay: string;
  target: number | null;
  targetDisplay: string;
  /** Partidas existentes quando o plano foi criado (para medir só as novas). */
  matchesAtStart: number;
  lastMatchAtStart: number;
  days: PlanDay[];
  evaluation?: PlanEvaluation;
}

export interface PastPlan {
  id: string;
  createdAt: number;
  focus: SkillId;
  completedDays: number;
  verdict: PlanEvaluation['verdict'];
}

// ---- Previsão de elo ------------------------------------------------------------

export type ScenarioKey = 'conservative' | 'realistic' | 'optimistic';
export type ConfidenceLevel = 'alta' | 'média' | 'baixa';

export interface Scenario {
  key: ScenarioKey;
  label: string;
  winRate: number;
  games: number;
  currentAbs: number;
  projectedAbs: number;
  lpChange: number;
  confidence: ConfidenceLevel;
  /** Passo a passo do cálculo, em linguagem simples. */
  explanation: string[];
}

export interface HorizonForecast {
  days: 7 | 15 | 30;
  expectedGames: number;
  /** Projeção central (mediana das simulações do cenário realista). */
  central: number;
  /** Intervalo de incerteza: 10º e 90º percentis. */
  low: number;
  high: number;
  scenarios: Scenario[];
}

export interface PathPoint {
  day: number;
  p10: number;
  p50: number;
  p90: number;
  conservative: number;
  optimistic: number;
}

export interface PredictionInputs {
  rankedGames: number;
  winRates: Array<{ window: number; games: number; winRate: number | null }>;
  weightedWinRate: number;
  smoothedWinRate: number;
  stdError: number;
  effectiveSample: number;
  gamesPerWeek: number;
  gamesPerWeekBasis: string;
  lpGain: number;
  lpLoss: number;
  lpSource: 'observed' | 'default';
  lpSourceText: string;
  /** Ajuste pequeno na taxa de vitória pela evolução de KDA, farm e dano (indicadores auxiliares). */
  trendAdjustment: number;
  trendText: string;
  currentStreak: number;
}

export interface Prediction {
  status: 'ok' | 'insufficient' | 'unranked';
  /** Preenchido quando não há previsão: explica o que falta. */
  message?: string;
  currentRank: Rank | null;
  currentAbs: number | null;
  inputs?: PredictionInputs;
  horizons: HorizonForecast[];
  path: PathPoint[];
  confidence?: { level: ConfidenceLevel; score: number; reasons: string[] };
  headline?: string;
}

export interface PredictionRecord {
  at: number;
  currentAbs: number;
  rankedGames: number;
  winRate: number;
  gamesPerWeek: number;
  horizons: Array<{ days: number; low: number; central: number; high: number }>;
}

export interface GoalAnalysis {
  target: Rank;
  targetAbs: number;
  /** LP que faltam (0 quando a meta já foi atingida). */
  distance: number;
  reached: boolean;
  /** Ganho médio esperado de LP por partida com o desempenho atual. */
  lpPerGame: number;
  /** Partidas necessárias no ritmo atual; `null` quando a tendência atual não leva à meta. */
  gamesNeeded: number | null;
  weeksNeeded: number | null;
  currentWinRate: number;
  /** Taxa de vitória necessária para chegar em N partidas. */
  requiredWinRates: Array<{ games: number; label: string; winRate: number; feasible: boolean }>;
  /** Parcela das simulações em que a meta é alcançada em até 30 dias. */
  probability30: number;
  obstacles: Array<{ skill: SkillId; text: string; lessonIds: string[] }>;
  summary: string[];
}

// ---- Estado persistido e relatório ---------------------------------------------

export interface CoachState {
  version: 1;
  lessons: Record<string, LessonProgress>;
  /** Dias (AAAA-MM-DD, horário local) com alguma atividade de treino. */
  activityDays: string[];
  diagnoses: DiagnosisRecord[];
  plan: TrainingPlan | null;
  pastPlans: PastPlan[];
  predictions: PredictionRecord[];
  goal: { rank: Rank; setAt: number } | null;
}

export interface SkillMastery {
  skill: SkillId;
  /** Conhecimento teórico (testes das aulas), 0–100. `null` = nenhuma aula feita. */
  theory: number | null;
  /** Desempenho prático nas partidas, 0–100. `null` = amostra insuficiente. */
  practice: number | null;
  lessonsDone: number;
  lessonsTotal: number;
  /** Evolução prática desde a primeira aula concluída da habilidade. */
  practiceChange?: { matchesAfter: number; text: string; improved: boolean | null };
}

export interface LearningObjective {
  id: string;
  title: string;
  detail: string;
  progress: number;
  done: boolean;
}

export interface AcademySummary {
  level: { index: number; name: string; xp: number; nextAt: number | null; progress: number };
  lessonsCompleted: number;
  lessonsTotal: number;
  streakDays: number;
  trainedToday: boolean;
  /** Aproveitamento médio nos testes (0–1), `null` sem testes. */
  quizAverage: number | null;
  recommended: Array<{ lessonId: string; skill: SkillId | null; reason: string }>;
  mastery: SkillMastery[];
  objectives: LearningObjective[];
}

export interface CoachReport {
  generatedAt: number;
  source: DataSourceKind;
  playerName: string;
  academy: AcademySummary;
  diagnosis: Diagnosis;
  plan: TrainingPlan | null;
  pastPlans: PastPlan[];
  prediction: Prediction;
  goal: GoalAnalysis | null;
  progress: Record<string, LessonProgress>;
  predictionHistory: PredictionRecord[];
}

export const emptyCoachState = (): CoachState => ({
  version: 1,
  lessons: {},
  activityDays: [],
  diagnoses: [],
  plan: null,
  pastPlans: [],
  predictions: [],
  goal: null,
});
