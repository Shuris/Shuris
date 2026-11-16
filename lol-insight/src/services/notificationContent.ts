import { lessonById } from '@/coach/lessons';
import { SKILLS } from '@/coach/skills';
import type { CoachReport } from '@/coach/types';
import { summarize, withinDays } from '@/stats/aggregate';
import { pct, signed } from '@/stats/format';
import type { MatchReport } from '@/stats/matchReport';
import { rankLabel } from '@/stats/rank';
import type { Match } from '@/types';

/**
 * Textos das notificações, separados do agendamento para poderem ser testados.
 * Cada função devolve `null` quando não há nada útil a dizer.
 */
export interface NoticeContent {
  title: string;
  body: string;
  /** Rota aberta ao tocar na notificação. */
  url: string;
}

export function matchNotice(m: Match, report: MatchReport, championName: string): NoticeContent {
  const top = report.points[0];
  return {
    title: `${m.win ? 'Vitória' : 'Derrota'} com ${championName}: relatório pronto`,
    body: top ? `${top.title}. ${top.detail}` : report.headline,
    url: `/partida/${m.id}`,
  };
}

export function weeklyNotice(matches: Match[], asOf: number): NoticeContent | null {
  const week = withinDays(matches, asOf, 7);
  if (!week.length) return { title: 'Resumo semanal', body: 'Nenhuma partida nos últimos 7 dias. Que tal uma aula rápida na LOI Academy?', url: '/academy' };
  const s = summarize(week);
  const prev = summarize(withinDays(matches, asOf, 7, 7));
  const lp = week.reduce((t, m) => t + (m.lpDelta ?? 0), 0);
  const change = prev.games ? ` (${signed((s.winRate - prev.winRate) * 100)} p.p. em relação à semana anterior)` : '';
  return {
    title: 'Seu resumo semanal',
    body: `${s.games} ${s.games === 1 ? 'partida' : 'partidas'}, ${pct(s.winRate)} de vitórias${change}${week.some((m) => m.lpDelta !== undefined) ? `, ${signed(lp)} LP` : ''}. Toque para ver os detalhes.`,
    url: '/desempenho',
  };
}

export function trainingNotice(report: CoachReport | null): NoticeContent | null {
  if (!report) return null;
  const a = report.academy;
  const day = report.plan?.days.find((d) => !d.done);
  const lesson = day?.lessonId ? lessonById(day.lessonId) : a.recommended[0] ? lessonById(a.recommended[0].lessonId) : undefined;
  const focus = report.plan ? SKILLS[report.plan.focus]?.name : undefined;
  const streak = a.streakDays > 0 ? ` Sequência atual: ${a.streakDays} ${a.streakDays === 1 ? 'dia' : 'dias'}.` : '';
  return {
    title: focus ? `Treino do dia: ${focus.toLowerCase()}` : 'Hora do treino',
    body: `${lesson ? `Próxima aula: ${lesson.title}.` : 'Uma aula curta mantém o ritmo.'}${streak}`,
    url: lesson ? `/academy/aula/${lesson.id}` : '/academy',
  };
}

/** Meta de elo perto (até 30 LP) ou alcançada. */
export function goalNotice(report: CoachReport | null): NoticeContent | null {
  const g = report?.goal;
  if (!g) return null;
  if (g.reached) return { title: 'Meta de elo alcançada!', body: `Você chegou a ${rankLabel(g.target)}. Defina a próxima meta na Previsão de elo.`, url: '/previsao' };
  if (g.distance <= 30) return { title: `Falta pouco para ${rankLabel(g.target)}`, body: `Faltam ${g.distance} LP. Chance de chegar em 30 dias: ${pct(g.probability30)}.`, url: '/previsao' };
  return null;
}
