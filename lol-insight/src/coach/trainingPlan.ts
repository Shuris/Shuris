import type { Match } from '@/types';

import { formatSkillValue, measureSkill } from './diagnosis';
import { lessonById, lessonsBySkill, LESSONS } from './lessons';
import { SKILL_IDS } from './skills';
import type { CoachState, Diagnosis, PastPlan, PlanDay, PlanEvaluation, SkillId, TrainingPlan } from './types';

const WEEK = 7 * 86_400_000;
const FOCUS_TITLE: Record<SkillId, string> = {
  FARM: 'Melhorando o farm',
  LANE: 'Morrendo menos na rota',
  VISION: 'Controlando a visão',
  OBJECTIVES: 'Presença em objetivos',
  CLOSING: 'Convertendo vantagens',
  TEAMFIGHT: 'Lutando melhor em equipe',
  MENTAL: 'Mentalidade e regularidade',
  POOL: 'Enxugando o pool de campeões',
};
const OBJECTIVE: Record<SkillId, string> = {
  FARM: 'aumentar a média de CS por minuto',
  LANE: 'reduzir as mortes por partida',
  VISION: 'aumentar o placar de visão por minuto',
  OBJECTIVES: 'estar presente em mais objetivos épicos',
  CLOSING: 'vencer mais partidas em que você termina com vantagem',
  TEAMFIGHT: 'aumentar a participação em abates',
  MENTAL: 'manter o nível depois de derrotas seguidas',
  POOL: 'concentrar as partidas em poucos campeões',
};
const HIGHER: Record<SkillId, boolean> = { FARM: true, LANE: false, VISION: true, OBJECTIVES: true, CLOSING: true, TEAMFIGHT: true, MENTAL: true, POOL: true };

const done = (state: CoachState, lessonId: string) => !!state.lessons[lessonId]?.completedAt;

/** Meta da semana: um passo pequeno e alcançável a partir da linha de base do próprio jogador. */
function nextTarget(skill: SkillId, baseline: number): number {
  switch (skill) {
    case 'FARM':
      return baseline * 1.07;
    case 'LANE':
      return baseline * 0.9;
    case 'VISION':
      return baseline * 1.1;
    case 'TEAMFIGHT':
      return Math.min(1, baseline + 0.04);
    case 'OBJECTIVES':
    case 'CLOSING':
      return Math.min(1, baseline + 0.08);
    case 'MENTAL':
    case 'POOL':
      return Math.min(1, baseline + 0.1);
  }
}

/** Compara a métrica do foco nas partidas jogadas desde o início do plano com a linha de base. */
export function evaluatePlan(plan: TrainingPlan, matches: Match[]): PlanEvaluation {
  const since = matches.filter((m) => m.timestamp > plan.lastMatchAtStart);
  if (since.length < 3 || plan.baseline === null) {
    return {
      matchesSince: since.length,
      current: null,
      currentDisplay: '—',
      verdict: 'insufficient',
      text:
        plan.baseline === null
          ? 'Não havia amostra para definir uma linha de base neste foco.'
          : `${since.length} ${since.length === 1 ? 'partida nova' : 'partidas novas'} desde o início do plano. São necessárias ao menos 3 para avaliar a evolução.`,
    };
  }
  const m = measureSkill(plan.focus, since);
  if (!m) return { matchesSince: since.length, current: null, currentDisplay: '—', verdict: 'insufficient', text: 'As partidas novas não permitem medir este foco.' };
  const change = (m.value - plan.baseline) / Math.max(0.0001, Math.abs(plan.baseline));
  const better = HIGHER[plan.focus] ? change : -change;
  const verdict: PlanEvaluation['verdict'] = better >= 0.03 ? 'improved' : better <= -0.03 ? 'worse' : 'same';
  const word = verdict === 'improved' ? 'Melhorou' : verdict === 'worse' ? 'Piorou' : 'Ficou estável';
  return {
    matchesSince: since.length,
    current: m.value,
    currentDisplay: formatSkillValue(plan.focus, m.value),
    verdict,
    text: `${word}: de ${plan.baselineDisplay} para ${formatSkillValue(plan.focus, m.value)} em ${since.length} partidas novas.${since.length < 8 ? ' Amostra pequena: confirme nas próximas partidas.' : ''}`,
  };
}

/** Escolhe o foco da semana sem repetir o anterior sem necessidade. */
function chooseFocus(state: CoachState, diagnosis: Diagnosis, last: PastPlan | undefined): SkillId {
  const weak = diagnosis.weaknesses;
  if (weak.length) {
    // Repete o mesmo foco apenas se ele piorou ou se é o único ponto fraco.
    if (last && weak[0] === last.focus && weak.length > 1 && last.verdict !== 'worse') return weak[1];
    return weak[0];
  }
  // Sem pontos fracos medidos: segue a trilha, pela habilidade com mais aulas por fazer.
  const pending = SKILL_IDS.map((skill) => ({ skill, left: lessonsBySkill(skill).filter((l) => !done(state, l.id)).length }))
    .filter((x) => x.left > 0 && x.skill !== last?.focus)
    .sort((a, b) => b.left - a.left);
  return pending[0]?.skill ?? last?.focus ?? 'FARM';
}

function createPlan(state: CoachState, diagnosis: Diagnosis, matches: Match[], now: number, last: PastPlan | undefined): TrainingPlan {
  const focus = chooseFocus(state, diagnosis, last);
  const pool = lessonsBySkill(focus);
  const pending = pool.filter((l) => !done(state, l.id));
  // Aulas ainda não concluídas primeiro; se faltar, revisão das já feitas.
  const ordered = [...pending, ...pool.filter((l) => done(state, l.id))];
  const a = ordered[0] ?? LESSONS[0];
  const b = ordered[1] ?? LESSONS.find((l) => l.id !== a.id && !done(state, l.id)) ?? a;
  const skill = diagnosis.skills.find((s) => s.skill === focus);
  const baseline = skill?.value ?? null;
  const target = baseline === null ? null : nextTarget(focus, baseline);
  const review = (id: string) => (done(state, id) ? 'Revisão: ' : 'Aula: ');

  const days: PlanDay[] = [
    { day: 1, kind: 'lesson', title: `${review(a.id)}${a.title}`, description: a.objective, lessonId: a.id, done: false },
    { day: 2, kind: 'exercise', title: `Exercício: ${a.exercise.title}`, description: a.exercise.success, lessonId: a.id, done: false },
    { day: 3, kind: 'lesson', title: `${review(b.id)}${b.title}`, description: b.objective, lessonId: b.id, done: false },
    {
      day: 4,
      kind: 'apply',
      title: 'Aplicar em partidas',
      description: `Jogue ao menos 3 partidas com um único foco: ${OBJECTIVE[focus]}.${target !== null ? ` Meta: ${formatSkillValue(focus, target)}.` : ''}`,
      done: false,
    },
    { day: 5, kind: 'review', title: 'Revisão das estatísticas', description: 'Abra a aba Desempenho e compare as partidas desta semana com as anteriores.', done: false },
    { day: 6, kind: 'exercise', title: `Exercício: ${b.exercise.title}`, description: b.exercise.success, lessonId: b.id, done: false },
    { day: 7, kind: 'evaluate', title: 'Avaliação de evolução', description: 'Confira abaixo se a métrica do foco mudou nas partidas novas e escolha o próximo passo.', done: false },
  ];

  const sequence = state.pastPlans.length + 1;
  const newest = matches.reduce((t, m) => Math.max(t, m.timestamp), 0);
  return {
    id: `plano-${now}`,
    createdAt: now,
    sequence,
    focus,
    title: `Semana ${sequence} — ${FOCUS_TITLE[focus]}`,
    objective: `Objetivo: ${OBJECTIVE[focus]}.`,
    metricLabel: skill?.metricLabel ?? '',
    baseline,
    baselineDisplay: baseline === null ? 'sem linha de base' : formatSkillValue(focus, baseline),
    target,
    targetDisplay: target === null ? '—' : formatSkillValue(focus, target),
    matchesAtStart: matches.length,
    lastMatchAtStart: newest,
    days,
  };
}

/**
 * Mantém o plano semanal em dia: cria quando não existe, renova após 7 dias
 * (arquivando o anterior) e marca automaticamente os dias de aula já concluídos.
 */
export function ensurePlan(state: CoachState, diagnosis: Diagnosis, matches: Match[], now: number): CoachState {
  let plan = state.plan;
  let pastPlans = state.pastPlans;

  if (plan && now - plan.createdAt >= WEEK) {
    const evaluation = evaluatePlan(plan, matches);
    pastPlans = [...pastPlans, { id: plan.id, createdAt: plan.createdAt, focus: plan.focus, completedDays: plan.days.filter((d) => d.done).length, verdict: evaluation.verdict }].slice(-12);
    plan = null;
  }
  if (!plan) plan = createPlan({ ...state, pastPlans }, diagnosis, matches, now, pastPlans[pastPlans.length - 1]);

  const days = plan.days.map((d) => {
    if (d.kind !== 'lesson' || d.done || !d.lessonId) return d;
    const completed = state.lessons[d.lessonId]?.attempts.some((a) => a.at >= plan!.createdAt);
    return completed ? { ...d, done: true, doneAt: now } : d;
  });
  return { ...state, pastPlans, plan: { ...plan, days, evaluation: evaluatePlan(plan, matches) } };
}

export const planLesson = (day: PlanDay) => (day.lessonId ? lessonById(day.lessonId) : undefined);
