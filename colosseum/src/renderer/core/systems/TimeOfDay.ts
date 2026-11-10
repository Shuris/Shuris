// Hora do dia do jogo (lógica pura, sem renderização).
import type { DayNightMode } from '../model/types';

/** Duração de um dia completo no modo acelerado. */
export const CYCLE_MS = 10 * 60 * 1000;

/** Hora do dia normalizada: 0 = meia-noite, 0,5 = meio-dia. */
export function timeOfDay(mode: DayNightMode, now = Date.now()): number {
  if (mode === 'real') {
    const d = new Date(now);
    return (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;
  }
  return ((now % CYCLE_MS) / CYCLE_MS + 0.3) % 1;
}

export function phaseName(t: number): string {
  if (t < 0.22) return 'Noite';
  if (t < 0.3) return 'Amanhecer';
  if (t < 0.72) return 'Dia';
  if (t < 0.8) return 'Entardecer';
  return 'Noite';
}

/** Relógio do jogo no formato HH:MM. */
export function clockLabel(t: number): string {
  const mins = Math.floor(t * 24 * 60);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}
