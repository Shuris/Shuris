// Locais da cidade acessíveis pelo mapa.
import type { LocationId } from '../model/types';
import { t } from '../../i18n';

export interface LocationDef {
  id: LocationId;
  name: string;
  short: string;
  /** imagem de fundo (a Arena usa o anfiteatro do adversário escolhido) */
  bg: string;
  outdoor: boolean;
  /** horário de funcionamento [abre, fecha) em minutos; null = sempre aberto */
  hours: [number, number] | null;
  /** fecha aos domingos */
  closedSunday?: boolean;
  /** posição no mapa (pixels do mapa 640x360) */
  map: [number, number];
}

export const LOCATIONS: LocationDef[] = [
  { id: 'home', name: 'Alojamento', short: 'Dormir e descansar', bg: 'bg:loc_home', outdoor: false, hours: null, map: [100, 112] },
  { id: 'ludus', name: 'Ludus', short: 'Treinar', bg: 'bg:ludus', outdoor: true, hours: [6 * 60, 22 * 60], map: [122, 276] },
  { id: 'market', name: 'Mercado', short: 'Comprar e vender', bg: 'bg:loc_market', outdoor: true, hours: [7 * 60, 20 * 60], closedSunday: true, map: [300, 280] },
  { id: 'arena', name: 'Arena', short: 'Lutar', bg: 'bg:arena_capua', outdoor: true, hours: [7 * 60, 20 * 60], map: [562, 262] },
  { id: 'temple', name: 'Templo de Marte', short: 'Árvore de habilidades', bg: 'bg:loc_temple', outdoor: true, hours: null, map: [414, 72] },
  { id: 'forum', name: 'Fórum', short: 'Jornal (Capua Times)', bg: 'bg:loc_forum', outdoor: true, hours: null, map: [300, 150] },
  { id: 'tavern', name: 'Taverna', short: 'Comida, vinho e boatos', bg: 'bg:loc_tavern', outdoor: false, hours: [11 * 60, 24 * 60], map: [404, 172] },
  { id: 'baths', name: 'Termas', short: 'Recuperar energia', bg: 'bg:loc_baths', outdoor: true, hours: [8 * 60, 21 * 60], map: [212, 70] },
];

export function getLocation(id: LocationId): LocationDef {
  return LOCATIONS.find((l) => l.id === id) ?? LOCATIONS[0];
}

/** Dia 1 é uma segunda-feira. */
export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WEEKDAY_KEYS = ['wd.0', 'wd.1', 'wd.2', 'wd.3', 'wd.4', 'wd.5', 'wd.6'] as const;

export function weekdayIndex(day: number): number {
  return ((day % 7) + 7) % 7;
}

export function weekdayName(day: number): string {
  return t(WEEKDAY_KEYS[weekdayIndex(day)]);
}

export function isSunday(day: number): boolean {
  return weekdayIndex(day) === 0;
}

export function isOpen(loc: LocationDef, minutes: number, day = 1): boolean {
  if (loc.closedSunday && isSunday(day)) return false;
  if (!loc.hours) return true;
  return minutes >= loc.hours[0] && minutes < loc.hours[1];
}

export function hoursLabel(loc: LocationDef, day = 1): string {
  if (loc.closedSunday && isSunday(day)) return t('hours.closedSunday');
  if (!loc.hours) return t('hours.always');
  const h = (m: number) => t('hours.h', { n: Math.floor(m / 60) });
  return `${h(loc.hours[0])}–${h(loc.hours[1])}${loc.closedSunday ? t('hours.exceptSunday') : ''}`;
}
