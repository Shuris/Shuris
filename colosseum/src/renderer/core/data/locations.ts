// Locais da cidade acessíveis pelo mapa.
import type { LocationId } from '../model/types';

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
  { id: 'home', name: 'Alojamento', short: 'Dormir e descansar', bg: 'bg:loc_home', outdoor: false, hours: null, map: [86, 138] },
  { id: 'ludus', name: 'Ludus', short: 'Treinar', bg: 'bg:ludus', outdoor: true, hours: [6 * 60, 22 * 60], map: [140, 270] },
  { id: 'market', name: 'Mercado', short: 'Comprar e vender', bg: 'bg:loc_market', outdoor: true, hours: [7 * 60, 20 * 60], closedSunday: true, map: [326, 286] },
  { id: 'arena', name: 'Arena', short: 'Lutar', bg: 'bg:arena_capua', outdoor: true, hours: [7 * 60, 20 * 60], map: [530, 250] },
  { id: 'temple', name: 'Templo de Marte', short: 'Árvore de habilidades', bg: 'bg:loc_temple', outdoor: true, hours: null, map: [500, 78] },
  { id: 'forum', name: 'Fórum', short: 'Jornal (Folha Diurna)', bg: 'bg:loc_forum', outdoor: true, hours: null, map: [340, 168] },
  { id: 'baths', name: 'Termas', short: 'Recuperar energia', bg: 'bg:loc_baths', outdoor: true, hours: [8 * 60, 21 * 60], map: [232, 86] },
];

export function getLocation(id: LocationId): LocationDef {
  return LOCATIONS.find((l) => l.id === id) ?? LOCATIONS[0];
}

/** Dia 1 é uma segunda-feira. */
export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function weekdayIndex(day: number): number {
  return ((day % 7) + 7) % 7;
}

export function weekdayName(day: number): string {
  return WEEKDAYS[weekdayIndex(day)];
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
  if (loc.closedSunday && isSunday(day)) return 'fechado aos domingos';
  if (!loc.hours) return 'sempre aberto';
  const h = (m: number) => `${Math.floor(m / 60)}h`;
  return `${h(loc.hours[0])}–${h(loc.hours[1])}${loc.closedSunday ? ', exceto domingo' : ''}`;
}
