// Taverna (perto do fórum): refeição que recupera energia, vinho com boatos sobre
// o próximo rival (uma vez por dia) e conversa com os frequentadores.
import type { PlayerState } from '../model/types';
import { getLocation, isOpen } from '../data/locations';
import { advance, DAY_END, MAX_ENERGY, type Check } from './CalendarSystem';
import { nextRival, onTavernTalk } from './NewsSystem';
import type { Rng } from './rng';
import { t } from '../../i18n';

export const MEAL_ENERGY = 15;
export const MEAL_MINUTES = 30;
export const RUMOR_MINUTES = 45;
export const RUMOR_COST = 5;
export const TALK_MINUTES = 15;

export function mealCost(p: PlayerState): number {
  return 6 + p.level;
}

function openCheck(p: PlayerState, minutes: number): Check {
  if (!isOpen(getLocation('tavern'), p.minutes, p.day)) return t('tavern.closed');
  if (p.minutes + minutes > DAY_END) return t('cal.tooLate');
  return null;
}

export function canEat(p: PlayerState): Check {
  const c = openCheck(p, MEAL_MINUTES);
  if (c) return c;
  if (p.energy >= MAX_ENERGY) return t('cal.rested');
  if (p.coins < mealCost(p)) return t('err.noCoins');
  return null;
}

export function eat(p: PlayerState): Check {
  const err = canEat(p);
  if (err) return err;
  p.coins -= mealCost(p);
  p.energy = Math.min(MAX_ENERGY, p.energy + MEAL_ENERGY);
  advance(p, MEAL_MINUTES);
  return null;
}

export function canHearRumor(p: PlayerState): Check {
  const c = openCheck(p, RUMOR_MINUTES);
  if (c) return c;
  if (p.tavern.rumorDay === p.day) return t('tavern.rumorDone');
  if (p.coins < RUMOR_COST) return t('err.noCoins');
  return null;
}

export interface RumorResult {
  error: Check;
  /** adversário de quem se falou */
  rivalId: string;
  fame: number;
}

/** Paga uma rodada de vinho e ouve o que dizem do próximo rival (+1 de fama). */
export function hearRumor(p: PlayerState, rng: Rng): RumorResult {
  const err = canHearRumor(p);
  const rival = nextRival(p);
  if (err) return { error: err, rivalId: rival.id, fame: 0 };
  p.coins -= RUMOR_COST;
  p.tavern.rumorDay = p.day;
  if (!p.tavern.heard.includes(rival.id)) p.tavern.heard.push(rival.id);
  p.reputation += 1;
  advance(p, RUMOR_MINUTES);
  onTavernTalk(p, rng);
  return { error: null, rivalId: rival.id, fame: 1 };
}

export function canTalk(p: PlayerState): Check {
  return openCheck(p, TALK_MINUTES);
}

export function chat(p: PlayerState): Check {
  const err = canTalk(p);
  if (err) return err;
  advance(p, TALK_MINUTES);
  return null;
}
