import { recordQuizAttempt } from './engine';
import { lessonById } from './lessons';
import { emptyCoachState, type CoachState } from './types';

const DAY = 86_400_000;

/**
 * Progresso FICTÍCIO da conta demonstrativa na LOI Academy: algumas aulas
 * concluídas nos últimos dias (uma delas só na segunda tentativa), para que a
 * demonstração mostre níveis, histórico e evolução. Só é usado quando o
 * aparelho ainda não tem progresso salvo para a conta de demonstração.
 */
export function demoCoachState(now: number): CoachState {
  const plan: Array<[string, number, boolean]> = [
    ['f-last-hit', 9, true],
    ['f-estados-da-wave', 7, true],
    ['t-derrotas', 5, false],
    ['t-derrotas', 4, true],
    ['f-visao', 3, true],
    ['r-primeiros-10', 1, true],
  ];
  let state = emptyCoachState();
  for (const [id, daysAgo, pass] of plan) {
    const lesson = lessonById(id);
    if (!lesson) continue;
    // Aprovado: acerta tudo menos, às vezes, uma questão; reprovado: erra a maioria.
    const answers = lesson.quiz.map((q, i) => (pass ? (i === 1 && daysAgo % 2 ? (q.correct + 1) % q.options.length : q.correct) : i === 0 ? q.correct : (q.correct + 1) % q.options.length));
    state = recordQuizAttempt(state, id, answers, 240 + daysAgo * 17, now - daysAgo * DAY - 3 * 3_600_000).state;
  }
  return state;
}
