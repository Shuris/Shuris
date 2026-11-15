import { rankLabel, rankToAbsolute } from '@/stats/rank';
import type { Match } from '@/types';

import { formatSkillValue, measureSkill } from './diagnosis';
import { LESSONS, lessonsByCategory, lessonsBySkill } from './lessons';
import { CATEGORIES, CATEGORY_IDS, SKILL_IDS, SKILLS } from './skills';
import type { AcademySummary, CoachState, Diagnosis, GoalAnalysis, LearningObjective, SkillId, SkillMastery } from './types';

const LEVELS = [
  { at: 0, name: 'Iniciante' },
  { at: 300, name: 'Aprendiz' },
  { at: 800, name: 'Praticante' },
  { at: 1400, name: 'Estrategista' },
  { at: 2100, name: 'Mestre da teoria' },
];
const HIGHER: Record<SkillId, boolean> = { FARM: true, LANE: false, VISION: true, OBJECTIVES: true, CLOSING: true, TEAMFIGHT: true, MENTAL: true, POOL: true };

/** Data local no formato AAAA-MM-DD. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Dias consecutivos de treino, contando até hoje (ou até ontem, se hoje ainda não houve treino). */
export function trainingStreak(days: string[], now: number): number {
  const set = new Set(days);
  let cursor = new Date(now);
  if (!set.has(dayKey(cursor.getTime()))) cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  let streak = 0;
  while (set.has(dayKey(cursor.getTime()))) {
    streak++;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  }
  return streak;
}

const completed = (state: CoachState, id: string) => !!state.lessons[id]?.completedAt;

/**
 * Domínio por habilidade, em duas medidas separadas:
 *  - teoria: cobertura das aulas × aproveitamento nos testes;
 *  - prática: desempenho nas partidas (do diagnóstico).
 * Acertar o teste não altera a nota prática: ela só muda com partidas novas.
 */
export function skillMastery(state: CoachState, diagnosis: Diagnosis, matches: Match[]): SkillMastery[] {
  return SKILL_IDS.map((skill) => {
    const lessons = lessonsBySkill(skill);
    const done = lessons.filter((l) => completed(state, l.id));
    const theory = done.length ? Math.round((done.reduce((s, l) => s + state.lessons[l.id].bestScore, 0) / lessons.length) * 100) : null;
    const practice = diagnosis.skills.find((s) => s.skill === skill)?.practice ?? null;

    let practiceChange: SkillMastery['practiceChange'];
    const first = done.map((l) => state.lessons[l.id].completedAt!).sort((a, b) => a - b)[0];
    if (first) {
      const after = matches.filter((m) => m.timestamp > first);
      const before = matches.filter((m) => m.timestamp <= first);
      const a = after.length >= 5 ? measureSkill(skill, after) : null;
      const b = before.length >= 5 ? measureSkill(skill, before) : null;
      if (a && b) {
        const better = HIGHER[skill] ? a.value > b.value * 1.03 : a.value < b.value * 0.97;
        const worse = HIGHER[skill] ? a.value < b.value * 0.97 : a.value > b.value * 1.03;
        practiceChange = {
          matchesAfter: after.length,
          improved: better ? true : worse ? false : null,
          text: `Desde a primeira aula: ${formatSkillValue(skill, b.value)} → ${formatSkillValue(skill, a.value)} (${after.length} partidas).`,
        };
      } else {
        practiceChange = {
          matchesAfter: after.length,
          improved: null,
          text: `${after.length} ${after.length === 1 ? 'partida' : 'partidas'} desde a primeira aula: são necessárias 5 para medir a evolução prática.`,
        };
      }
    }
    return { skill, theory, practice, lessonsDone: done.length, lessonsTotal: lessons.length, practiceChange };
  });
}

/** Aulas recomendadas: primeiro as dos pontos fracos (mais graves antes), depois a sequência da trilha. */
export function recommend(state: CoachState, diagnosis: Diagnosis, limit = 4): AcademySummary['recommended'] {
  const out: AcademySummary['recommended'] = [];
  const add = (lessonId: string, skill: SkillId | null, reason: string) => {
    if (out.length < limit && !out.some((r) => r.lessonId === lessonId)) out.push({ lessonId, skill, reason });
  };
  for (const skill of diagnosis.weaknesses) {
    const d = diagnosis.skills.find((s) => s.skill === skill)!;
    const pending = lessonsBySkill(skill).filter((l) => !completed(state, l.id));
    for (const l of pending.slice(0, 2)) add(l.id, skill, `${SKILLS[skill].name}: ${d.display} (${d.reference}).`);
  }
  for (const l of LESSONS) if (!completed(state, l.id)) add(l.id, null, diagnosis.enough ? 'Próxima aula da trilha.' : 'Trilha geral: ainda não há partidas suficientes para um diagnóstico.');
  return out;
}

export function lessonsFor(state: CoachState, skill: SkillId): string[] {
  const all = lessonsBySkill(skill);
  const pending = all.filter((l) => !completed(state, l.id));
  return (pending.length ? pending : all).slice(0, 3).map((l) => l.id);
}

export function summarizeAcademy(state: CoachState, diagnosis: Diagnosis, matches: Match[], goal: GoalAnalysis | null, currentAbs: number | null, now: number): AcademySummary {
  const done = LESSONS.filter((l) => completed(state, l.id));
  const xp = Math.round(done.reduce((s, l) => s + 60 + 40 * state.lessons[l.id].bestScore, 0));
  const index = LEVELS.reduce((best, lvl, i) => (xp >= lvl.at ? i : best), 0);
  const next = LEVELS[index + 1];
  const attempts = Object.values(state.lessons).flatMap((p) => p.attempts);
  const streak = trainingStreak(state.activityDays, now);

  const objectives: LearningObjective[] = [];
  if (state.plan) {
    const n = state.plan.days.filter((d) => d.done).length;
    objectives.push({ id: 'plan', title: 'Concluir o plano da semana', detail: `${n} de 7 dias · ${state.plan.title}`, progress: n / 7, done: n === 7 });
    if (state.plan.target !== null && state.plan.evaluation) {
      const ev = state.plan.evaluation;
      objectives.push({
        id: 'metric',
        title: `Meta prática: ${state.plan.targetDisplay}`,
        detail: ev.verdict === 'insufficient' ? `Linha de base: ${state.plan.baselineDisplay}. ${ev.text}` : ev.text,
        progress: ev.verdict === 'improved' ? 1 : ev.verdict === 'same' ? 0.5 : 0,
        done: ev.verdict === 'improved',
      });
    }
  }
  const category = CATEGORY_IDS.map((id) => {
    const list = lessonsByCategory(id);
    return { id, total: list.length, n: list.filter((l) => completed(state, l.id)).length };
  })
    .filter((c) => c.n < c.total)
    .sort((a, b) => b.n / b.total - a.n / a.total)[0];
  if (category) {
    objectives.push({
      id: 'category',
      title: `Completar "${CATEGORIES[category.id].name}"`,
      detail: `${category.n} de ${category.total} aulas concluídas`,
      progress: category.n / category.total,
      done: false,
    });
  }
  objectives.push({ id: 'streak', title: 'Treinar 3 dias seguidos', detail: `Sequência atual: ${streak} ${streak === 1 ? 'dia' : 'dias'}`, progress: Math.min(1, streak / 3), done: streak >= 3 });
  if (goal && currentAbs !== null) {
    const origin = Math.min(currentAbs, rankToAbsolute(goal.target) - 1);
    objectives.push({
      id: 'rank',
      title: `Chegar a ${rankLabel(goal.target)}`,
      detail: goal.reached ? 'Meta atingida.' : `Faltam ${goal.distance} LP`,
      progress: goal.reached ? 1 : Math.max(0, Math.min(1, 1 - goal.distance / Math.max(100, rankToAbsolute(goal.target) - origin + goal.distance))),
      done: goal.reached,
    });
  }

  return {
    level: { index, name: LEVELS[index].name, xp, nextAt: next?.at ?? null, progress: next ? (xp - LEVELS[index].at) / (next.at - LEVELS[index].at) : 1 },
    lessonsCompleted: done.length,
    lessonsTotal: LESSONS.length,
    streakDays: streak,
    trainedToday: state.activityDays.includes(dayKey(now)),
    quizAverage: attempts.length ? attempts.reduce((s, a) => s + a.correct / a.total, 0) / attempts.length : null,
    recommended: recommend(state, diagnosis),
    mastery: skillMastery(state, diagnosis, matches),
    objectives,
  };
}
