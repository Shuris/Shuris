// Fórmulas puras de resolução de golpes. Sem estado, sem renderização.
import type { CombatStats } from '../systems/AttributeSystem';
import { DODGE_CAP } from '../systems/AttributeSystem';
import type { StrategyDef } from '../data/skills';
import { clamp } from '../systems/rng';

/**
 * Ritmo global de dano. As fórmulas da especificação (vida = 100 + VIT×12,
 * dano = 8 + FOR×1,8 + arma) produzem lutas de ~20 s; este fator ajusta a
 * duração para a faixa desejada de 45–90 s sem distorcer as proporções.
 */
export const DAMAGE_PACE = 0.36;
export const CRIT_MULTIPLIER = 1.6;
export const MIN_HIT = 0.5;
export const MAX_HIT = 0.98;

export function hitChance(attacker: CombatStats, defender: CombatStats, fatigued: boolean, defenderExhausted: boolean): number {
  let c = 0.85 + (attacker.precision - defender.precision) * 0.005;
  if (fatigued) c -= 0.05;
  if (defenderExhausted) c += 0.1;
  return clamp(c, MIN_HIT, MAX_HIT);
}

/** Chance de esquiva: total quando reage ativamente, metade quando apenas parado. */
export function dodgeChance(defender: CombatStats, strategy: StrategyDef, active: boolean): number {
  if (active) return Math.min(DODGE_CAP, defender.dodgeChance + strategy.dodgeBonus);
  return Math.min(DODGE_CAP, defender.dodgeChance * 0.5);
}

export function blockEfficiency(defender: CombatStats, strategy: StrategyDef, vsPowerStrike: boolean): number {
  let b = defender.blockPower + strategy.blockBonus;
  if (vsPowerStrike) b *= 0.6;
  return clamp(b, 0, 0.85);
}

export interface DamageInput {
  attacker: CombatStats;
  defender: CombatStats;
  attackerStrategy: StrategyDef;
  damageMul: number;
  variance: number; // 0..1 aleatório
  crit: boolean;
  fatigued: boolean;
  blockEff: number; // 0 se não bloqueou
  fortifyMul: number; // 1 se sem defesa reforçada
}

export function computeDamage(i: DamageInput): number {
  let d = i.attacker.baseDamage * DAMAGE_PACE;
  d *= 0.88 + i.variance * 0.24;
  d *= i.damageMul * i.attackerStrategy.damageMul;
  if (i.fatigued) d *= 0.85;
  if (i.crit) d *= CRIT_MULTIPLIER;
  const def = Math.max(0, i.defender.defense - i.attacker.armorPierce);
  d *= 1 - Math.min(0.7, def / (def + 100));
  d *= 1 - i.blockEff;
  d *= i.fortifyMul;
  return Math.max(1, Math.round(d));
}

export function powerStrikeMul(tech: number): number {
  return 1.6 + tech * 0.012;
}
export function quickStrikeMul(tech: number): number {
  return 0.75 + tech * 0.005;
}
export function counterMul(tech: number): number {
  return 1.3 + tech * 0.008;
}
export function counterChance(tech: number): number {
  return Math.min(0.75, 0.3 + tech * 0.006);
}
export function fortifyMultiplier(tech: number): number {
  return Math.max(0.4, 0.65 - tech * 0.004);
}
export function fortifyDuration(tech: number): number {
  return 4 + tech * 0.04;
}
