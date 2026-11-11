// Favor da plateia: começa no meio e sobe com golpes bonitos do jogador (críticos,
// golpes fortes, esquivas, contra-ataques), cai quando ele apanha, erra ou enrola.
// No fim da luta a plateia decide o polegar: para cima vale fama extra; numa
// derrota, a plateia pode poupar o perdedor (sem perder fama) ou condená-lo.
import type { CombatEvent } from '../combat/CombatTypes';

export const FAVOR_START = 50;
export const THUMB_UP = 60;
export const THUMB_DOWN = 30;

export function favorAfter(favor: number, e: CombatEvent): number {
  let d = 0;
  if (e.type === 'impact') {
    const mine = e.side === 0;
    if (e.outcome === 'hit') {
      if (mine) d = 2 + (e.crit ? 6 : 0) + (e.kind === 'power_strike' ? 4 : 0) + (e.kind === 'counter' ? 5 : 0) + (e.stagger ? 2 : 0);
      else d = -(1.5 + (e.crit ? 3 : 0));
    } else if (e.outcome === 'dodge') d = mine ? -1 : 4;
    else if (e.outcome === 'block') d = mine ? -0.5 : 1.5;
    else if (e.outcome === 'miss') d = mine ? -1 : 1;
  } else if (e.type === 'skill' && e.side === 0) d = 2;
  else if (e.type === 'secondWind' && e.side === 0) d = 6;
  else if (e.type === 'exhausted') d = e.side === 0 ? -3 : 2;
  else if (e.type === 'end') {
    if (e.reason === 'ko') d = e.winner === 0 ? 10 : -4;
    if (e.reason === 'forfeit' && e.winner === 1) d = -25;
  }
  return Math.max(0, Math.min(100, favor + d));
}

/** A luta arrastada sem golpes cansa a plateia (chamado a cada segundo sem ação). */
export function favorIdle(favor: number): number {
  return Math.max(0, favor - 0.6);
}

export type Thumb = 'up' | 'down' | 'none';

export function thumbOf(favor: number): Thumb {
  return favor >= THUMB_UP ? 'up' : favor < THUMB_DOWN ? 'down' : 'none';
}

/** Fama extra (ou perdida) pela decisão da plateia. */
export function favorFame(favor: number, won: boolean): number {
  const th = thumbOf(favor);
  if (won) return th === 'up' ? Math.round((favor - 40) / 6) : 0;
  return th === 'down' ? -3 : 0;
}

/** Na derrota com polegar para cima a plateia poupa o perdedor: não perde fama. */
export function sparedByCrowd(favor: number, won: boolean): boolean {
  return !won && thumbOf(favor) === 'up';
}
