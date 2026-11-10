// Sistema de dias: relógio, energia, deslocamentos, sono e termas.
import type { LocationId, PlayerState } from '../model/types';
import { getLocation, hoursLabel, isOpen, isSunday } from '../data/locations';

export const WAKE_TIME = 7 * 60;
export const MAX_ENERGY = 100;
export const FIGHT_ENERGY = 35;
export const FIGHT_MINUTES = 120;
export const TRAIN_ENERGY = 12;
export const TRAIN_MINUTES = 60;
export const TRAVEL_MINUTES = 20;
export const NAP_MINUTES = 120;
export const NAP_ENERGY = 20;
export const BATHS_ENERGY = 40;
export const BATHS_MINUTES = 60;
/** nenhuma ação pode passar da meia-noite: é preciso dormir */
export const DAY_END = 24 * 60;

export type Check = string | null;

function timeLeft(p: PlayerState, minutes: number): Check {
  if (p.minutes + minutes > DAY_END) return 'Está tarde demais. Vá dormir no alojamento.';
  return null;
}

export function canFight(p: PlayerState): Check {
  const arena = getLocation('arena');
  if (!isOpen(arena, p.minutes, p.day)) return 'A arena está fechada (abre das 7h às 20h). Durma e volte amanhã.';
  if (p.energy < FIGHT_ENERGY) return `Sem energia para lutar (precisa de ${FIGHT_ENERGY}). Descanse.`;
  return timeLeft(p, FIGHT_MINUTES);
}

export function canTrain(p: PlayerState): Check {
  if (!isOpen(getLocation('ludus'), p.minutes, p.day)) return 'O ludus está fechado (6h às 22h).';
  if (p.energy < TRAIN_ENERGY) return 'Cansado demais para treinar. Descanse.';
  return timeLeft(p, TRAIN_MINUTES);
}

export function canTravel(p: PlayerState, to: LocationId): Check {
  if (to === p.location) return 'Você já está aqui.';
  if (to === 'home') return p.minutes + TRAVEL_MINUTES > DAY_END + 120 ? 'Tarde demais.' : null;
  return timeLeft(p, TRAVEL_MINUTES);
}

/** Avança o relógio (sem passar do fim do dia). */
export function advance(p: PlayerState, minutes: number): void {
  p.minutes = Math.min(DAY_END + 120, p.minutes + Math.max(0, Math.round(minutes)));
}

export function spendEnergy(p: PlayerState, amount: number): void {
  p.energy = Math.max(0, Math.min(MAX_ENERGY, p.energy - amount));
}

export function travel(p: PlayerState, to: LocationId): Check {
  const err = canTravel(p, to);
  if (err) return err;
  advance(p, TRAVEL_MINUTES);
  p.location = to;
  return null;
}

export function applyFight(p: PlayerState): void {
  spendEnergy(p, FIGHT_ENERGY);
  advance(p, FIGHT_MINUTES);
}

export function applyTraining(p: PlayerState): void {
  spendEnergy(p, TRAIN_ENERGY);
  advance(p, TRAIN_MINUTES);
}

/** Comprar e vender só com o mercado aberto (fecha à noite e aos domingos). */
export function canTrade(p: PlayerState): Check {
  const market = getLocation('market');
  if (isOpen(market, p.minutes, p.day)) return null;
  if (isSunday(p.day)) return 'O mercado não abre aos domingos.';
  return `O mercado está fechado (${hoursLabel(market, p.day)}).`;
}

export function canNap(p: PlayerState): Check {
  if (p.energy >= MAX_ENERGY) return 'Você já está descansado.';
  return timeLeft(p, NAP_MINUTES);
}

export function nap(p: PlayerState): Check {
  const err = canNap(p);
  if (err) return err;
  advance(p, NAP_MINUTES);
  p.energy = Math.min(MAX_ENERGY, p.energy + NAP_ENERGY);
  return null;
}

export function bathsCost(p: PlayerState): number {
  return 15 + p.level * 3;
}

export function canBathe(p: PlayerState): Check {
  if (!isOpen(getLocation('baths'), p.minutes, p.day)) return 'As termas estão fechadas (8h às 21h).';
  if (p.energy >= MAX_ENERGY) return 'Você já está descansado.';
  if (p.coins < bathsCost(p)) return 'Moedas insuficientes.';
  return timeLeft(p, BATHS_MINUTES);
}

export function bathe(p: PlayerState): Check {
  const err = canBathe(p);
  if (err) return err;
  p.coins -= bathsCost(p);
  advance(p, BATHS_MINUTES);
  p.energy = Math.min(MAX_ENERGY, p.energy + BATHS_ENERGY);
  return null;
}

/** Dorme até a manhã seguinte: novo dia, energia cheia, de volta ao alojamento. */
export function sleep(p: PlayerState): void {
  p.day += 1;
  p.minutes = WAKE_TIME;
  p.energy = MAX_ENERGY;
  p.location = 'home';
}
