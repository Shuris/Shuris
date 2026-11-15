const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAYS_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits).replace('.', ',')}%`;
export const dec = (v: number, digits = 1) => {
  const s = v.toFixed(digits);
  return (Number(s) === 0 ? s.replace('-', '') : s).replace('.', ',');
};
export const int = (v: number) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const compact = (v: number) => (v >= 1_000_000 ? `${dec(v / 1_000_000, 2)} mi` : v >= 1000 ? `${dec(v / 1000, 1)} mil` : int(v));
/** Versão curta para eixos de gráfico (ex.: 24k). */
export const axisCompact = (v: number) => (Math.abs(v) >= 1000 ? `${dec(v / 1000, 0)}k` : dec(v, 0));
export const signed = (v: number, digits = 0) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${dec(Math.abs(v), digits)}`;

export function duration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function dateShort(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function dateTime(ts: number): string {
  const d = new Date(ts);
  return `${dateShort(ts)} · ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function relativeDay(ts: number, asOf: number): string {
  const a = new Date(ts);
  const b = new Date(asOf);
  const days = Math.round(
    (new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() -
      new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) /
      86_400_000,
  );
  if (days <= 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return `Há ${days} dias`;
  return dateShort(ts);
}

export const QUEUE_LABEL = { SOLO: 'Ranqueada Solo/Duo', FLEX: 'Ranqueada Flex', NORMAL: 'Normal' } as const;
export const QUEUE_SHORT = { SOLO: 'Solo/Duo', FLEX: 'Flex', NORMAL: 'Normal' } as const;
