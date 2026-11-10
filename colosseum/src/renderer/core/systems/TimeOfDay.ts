// Hora do dia do jogo (lógica pura). O relógio avança com as ações do jogador.
import { t as tr } from '../../i18n';

/** Fração do dia: 0 = meia-noite, 0,5 = meio-dia. */
export function dayFraction(minutes: number): number {
  return (((minutes % 1440) + 1440) % 1440) / 1440;
}

export function phaseName(t: number): string {
  if (t < 0.22) return tr('phase.night');
  if (t < 0.3) return tr('phase.dawn');
  if (t < 0.5) return tr('phase.morning');
  if (t < 0.72) return tr('phase.afternoon');
  if (t < 0.8) return tr('phase.dusk');
  return tr('phase.night');
}

/** Relógio no formato HH:MM. */
export function clockLabel(t: number): string {
  const mins = Math.floor(t * 24 * 60 + 1e-6);
  return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}
