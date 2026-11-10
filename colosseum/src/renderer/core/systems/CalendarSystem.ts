// Sistema de dias: relógio, energia, deslocamentos, sono e termas.
import type { LocationId, PlayerState } from '../model/types';
import { getLocation, hoursLabel, isOpen, isSunday } from '../data/locations';
import { napBonus, trainEnergyCut } from '../data/upgrades';
import { t } from '../../i18n';

/** Energia gasta por treino (o doctore particular reduz). */
export function trainEnergy(p: PlayerState): number {
  return TRAIN_ENERGY - trainEnergyCut(p);
}

/** Energia recuperada num cochilo (cama melhor recupera mais). */
export function napEnergy(p: PlayerState): number {
  return NAP_ENERGY + napBonus(p);
}

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
  if (p.minutes + minutes > DAY_END) return t('cal.tooLate');
  return null;
}

export function canFight(p: PlayerState): Check {
  const arena = getLocation('arena');
  if (!isOpen(arena, p.minutes, p.day)) return t('cal.arenaClosed');
  if (p.energy < FIGHT_ENERGY) return t('cal.noEnergyFight', { n: FIGHT_ENERGY });
  return timeLeft(p, FIGHT_MINUTES);
}

export function canTrain(p: PlayerState): Check {
  if (!isOpen(getLocation('ludus'), p.minutes, p.day)) return t('cal.ludusClosed');
  if (p.energy < trainEnergy(p)) return t('cal.tooTired');
  return timeLeft(p, TRAIN_MINUTES);
}

export function canTravel(p: PlayerState, to: LocationId): Check {
  if (to === p.location) return t('cal.alreadyHere');
  if (to === 'home') return p.minutes + TRAVEL_MINUTES > DAY_END + 120 ? t('cal.tooLateShort') : null;
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
  spendEnergy(p, trainEnergy(p));
  advance(p, TRAIN_MINUTES);
}

/** Comprar e vender só com o mercado aberto (fecha à noite e aos domingos). */
export function canTrade(p: PlayerState): Check {
  const market = getLocation('market');
  if (isOpen(market, p.minutes, p.day)) return null;
  if (isSunday(p.day)) return t('cal.marketSunday');
  return t('cal.marketClosed', { hours: hoursLabel(market, p.day) });
}

export function canNap(p: PlayerState): Check {
  if (p.energy >= MAX_ENERGY) return t('cal.rested');
  return timeLeft(p, NAP_MINUTES);
}

export function nap(p: PlayerState): Check {
  const err = canNap(p);
  if (err) return err;
  advance(p, NAP_MINUTES);
  p.energy = Math.min(MAX_ENERGY, p.energy + napEnergy(p));
  return null;
}

export function bathsCost(p: PlayerState): number {
  return 15 + p.level * 3;
}

export function canBathe(p: PlayerState): Check {
  if (!isOpen(getLocation('baths'), p.minutes, p.day)) return t('cal.bathsClosed');
  if (p.energy >= MAX_ENERGY) return t('cal.rested');
  if (p.coins < bathsCost(p)) return t('err.noCoins');
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
