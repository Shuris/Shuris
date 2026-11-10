// Hora do dia do jogo (lógica pura). O relógio avança com as ações do jogador.

/** Fração do dia: 0 = meia-noite, 0,5 = meio-dia. */
export function dayFraction(minutes: number): number {
  return (((minutes % 1440) + 1440) % 1440) / 1440;
}

export function phaseName(t: number): string {
  if (t < 0.22) return 'Noite';
  if (t < 0.3) return 'Amanhecer';
  if (t < 0.5) return 'Manhã';
  if (t < 0.72) return 'Tarde';
  if (t < 0.8) return 'Entardecer';
  return 'Noite';
}

/** Relógio no formato HH:MM. */
export function clockLabel(t: number): string {
  const mins = Math.floor(t * 24 * 60 + 1e-6);
  return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}
