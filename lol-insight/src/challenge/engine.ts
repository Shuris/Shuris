import { CHALLENGES, challengeById } from './bank';
import { CATEGORY_IDS, DIFFICULTY_IDS, type Challenge, type ChallengeAttempt, type ChallengeCategory, type ChallengeDifficulty } from './types';

/**
 * Regras do LOL Challenge, usadas igualmente pelo app (demonstração) e pelo
 * servidor (contas reais): XP, níveis, sequência de dias, calendário,
 * estatísticas e conquistas. Só a PRIMEIRA resposta a cada desafio conta.
 */

export const XP_BY_DIFFICULTY: Record<ChallengeDifficulty, number> = { facil: 10, medio: 20, dificil: 30 };
export const DAILY_BONUS = 15;

const LEVEL_NAMES = ['Recruta', 'Aprendiz', 'Analista', 'Estrategista', 'Tático', 'Comandante', 'Mestre tático', 'Lenda'];

/** XP total necessário para chegar ao nível `n` (nível 1 = 0 XP). */
export const xpForLevel = (n: number) => 50 * (n - 1) * n;

export function levelFor(xp: number) {
  let n = 1;
  while (xpForLevel(n + 1) <= xp) n++;
  const from = xpForLevel(n);
  const to = xpForLevel(n + 1);
  return { level: n, name: LEVEL_NAMES[Math.min(LEVEL_NAMES.length - 1, Math.floor((n - 1) / 2))], xp, from, to, progress: (xp - from) / (to - from) };
}

/** Dia local (AAAA-MM-DD) de um instante, dado o deslocamento do fuso em minutos (ex.: −180 para Brasília). */
export function dayOf(at: number, tzOffsetMin = 0): string {
  return new Date(at + tzOffsetMin * 60_000).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Desafio diário: o mesmo para todos os jogadores no mesmo dia. */
export function dailyChallenge(day: string): Challenge {
  return CHALLENGES[hash(`daily:${day}`) % CHALLENGES.length];
}

/**
 * Chave única de uma tentativa: o diário vale uma vez por dia (mesmo que o
 * desafio do dia já tenha aparecido antes); os demais, uma vez por desafio.
 */
export const attemptKey = (a: Pick<ChallengeAttempt, 'daily' | 'day' | 'challengeId'>) => (a.daily ? `daily:${a.day}` : a.challengeId);

/** Avalia uma resposta e monta o registro da tentativa (sem gravar nada). */
export function grade(challengeId: string, answer: number, at: number, day: string, asDaily = false): ChallengeAttempt {
  const c = challengeById(challengeId);
  if (!c) throw new Error('UNKNOWN_CHALLENGE');
  if (!Number.isInteger(answer) || answer < 0 || answer >= c.options.length) throw new Error('INVALID_ANSWER');
  const correct = answer === c.answer;
  const daily = asDaily && dailyChallenge(day).id === c.id;
  if (asDaily && !daily) throw new Error('NOT_TODAYS_DAILY');
  return { challengeId, answer, correct, at, day, daily, xp: correct ? XP_BY_DIFFICULTY[c.difficulty] + (daily ? DAILY_BONUS : 0) : 0 };
}

export interface Achievement {
  id: string;
  title: string;
  detail: string;
  unlocked: boolean;
  /** Progresso de 0 a 1 até desbloquear. */
  progress: number;
}

export interface Rate {
  attempts: number;
  correct: number;
}

export interface ChallengeState {
  attempts: ChallengeAttempt[];
  xp: number;
  level: ReturnType<typeof levelFor>;
  today: string;
  daily: Challenge;
  dailyAttempt: ChallengeAttempt | null;
  /** Dias seguidos com o desafio diário respondido, terminando hoje ou ontem. */
  streak: number;
  bestStreak: number;
  /** dia → resumo do dia. */
  calendar: Record<string, { attempts: number; correct: number; daily: boolean }>;
  byCategory: Record<ChallengeCategory, Rate>;
  byDifficulty: Record<ChallengeDifficulty, Rate>;
  achievements: Achievement[];
  /** Desafios ainda não respondidos, a categoria mais fraca primeiro. */
  next: Challenge[];
  total: number;
}

const rate = (): Rate => ({ attempts: 0, correct: 0 });

export function buildState(attemptsIn: ChallengeAttempt[], today: string): ChallengeState {
  const attempts = [...attemptsIn].sort((a, b) => a.at - b.at);
  const xp = attempts.reduce((t, a) => t + a.xp, 0);
  const calendar: ChallengeState['calendar'] = {};
  const byCategory = Object.fromEntries(CATEGORY_IDS.map((k) => [k, rate()])) as Record<ChallengeCategory, Rate>;
  const byDifficulty = Object.fromEntries(DIFFICULTY_IDS.map((k) => [k, rate()])) as Record<ChallengeDifficulty, Rate>;
  for (const a of attempts) {
    const d = (calendar[a.day] ??= { attempts: 0, correct: 0, daily: false });
    d.attempts++;
    if (a.correct) d.correct++;
    if (a.daily) d.daily = true;
    const c = challengeById(a.challengeId);
    if (c) {
      byCategory[c.category].attempts++;
      byDifficulty[c.difficulty].attempts++;
      if (a.correct) {
        byCategory[c.category].correct++;
        byDifficulty[c.difficulty].correct++;
      }
    }
  }
  // Sequência: dias consecutivos com o diário respondido.
  const dailyDays = new Set(attempts.filter((a) => a.daily).map((a) => a.day));
  let streak = 0;
  let cursor = dailyDays.has(today) ? today : addDays(today, -1);
  while (dailyDays.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  let bestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of [...dailyDays].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    prev = d;
  }
  const daily = dailyChallenge(today);
  const done = new Set(attempts.map((a) => a.challengeId));
  const correctTotal = attempts.filter((a) => a.correct).length;
  const accuracy = (k: ChallengeCategory) => (byCategory[k].attempts ? byCategory[k].correct / byCategory[k].attempts : 1);
  const next = CHALLENGES.filter((c) => !done.has(c.id)).sort((a, b) => accuracy(a.category) - accuracy(b.category) || DIFFICULTY_IDS.indexOf(a.difficulty) - DIFFICULTY_IDS.indexOf(b.difficulty));
  const hardCorrect = byDifficulty.dificil.correct;
  const triedCats = CATEGORY_IDS.filter((k) => byCategory[k].attempts > 0).length;
  const perfectCat = CATEGORY_IDS.some((k) => {
    const total = CHALLENGES.filter((c) => c.category === k).length;
    return byCategory[k].correct === total;
  });
  const ach = (id: string, title: string, detail: string, value: number, goal: number): Achievement => ({ id, title, detail, unlocked: value >= goal, progress: Math.min(1, value / goal) });
  const achievements: Achievement[] = [
    ach('first', 'Primeira leitura', 'Acerte o seu primeiro desafio', correctTotal, 1),
    ach('streak3', 'Ritmo', 'Responda o diário 3 dias seguidos', bestStreak, 3),
    ach('streak7', 'Semana completa', 'Responda o diário 7 dias seguidos', bestStreak, 7),
    ach('streak30', 'Disciplina', 'Responda o diário 30 dias seguidos', bestStreak, 30),
    ach('correct10', 'Leitura de jogo', 'Acerte 10 desafios', correctTotal, 10),
    ach('correct25', 'Analista', 'Acerte 25 desafios', correctTotal, 25),
    ach('hard5', 'Sem medo', 'Acerte 5 desafios difíceis', hardCorrect, 5),
    ach('allcats', 'Visão completa', 'Responda desafios das 6 categorias', triedCats, 6),
    ach('perfect', 'Especialista', 'Acerte todos os desafios de uma categoria', perfectCat ? 1 : 0, 1),
  ];
  return {
    attempts,
    xp,
    level: levelFor(xp),
    today,
    daily,
    dailyAttempt: attempts.find((a) => a.daily && a.day === today) ?? null,
    streak,
    bestStreak,
    calendar,
    byCategory,
    byDifficulty,
    achievements,
    next,
    total: CHALLENGES.length,
  };
}

/**
 * Histórico FICTÍCIO da conta demonstrativa: dias anteriores a `today`, com
 * acertos e erros plausíveis. Marcado como `seeded` para a interface avisar.
 */
export function demoHistory(today: string): ChallengeAttempt[] {
  const out: ChallengeAttempt[] = [];
  const used = new Set<string>();
  for (let back = 26; back >= 1; back--) {
    const day = addDays(today, -back);
    const h = hash(`demo:${day}`);
    if (h % 7 === 0 && back > 6) continue; // alguns dias sem treino, mas a semana atual completa
    const at = Date.parse(`${day}T21:00:00Z`) + (h % 3600) * 1000;
    const pick = (c: Challenge, asDaily: boolean, salt: number) => {
      const correct = ((h >>> salt) % 10) < 7;
      const answer = correct ? c.answer : (c.answer + 1) % c.options.length;
      out.push({ ...grade(c.id, answer, at + salt * 60_000, day, asDaily), seeded: true });
    };
    pick(dailyChallenge(day), true, 3);
    if (h % 3 === 0) {
      const extra = CHALLENGES.find((c) => !used.has(c.id));
      if (extra) {
        used.add(extra.id);
        pick(extra, false, 7);
      }
    }
  }
  return out;
}
