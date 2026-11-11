import type { Appearance, ItemDef, PlayerState, Slot } from '../model/types';
import { SLOTS } from '../model/types';
import type { CombatantSpec } from './CombatTypes';
import { computeCombatStats, equippedItems, finalAttributes, naturalAttributes, DODGE_CAP, MIN_ATTACK_INTERVAL, type CombatStats } from '../systems/AttributeSystem';
import { autoPerks, combinedMods, skillsFromPerks } from '../systems/SkillTreeSystem';
import { getItem } from '../data/equipment';
import { opponentAttributes, type OpponentDef } from '../data/opponents';
import { opponentFullName } from '../../i18n/data';

/** multiplicadores das feras (dano das garras e vida), calibrados para ~40% de vitória de um gladiador médio do mesmo nível */
export const BEAST_STATS: Record<string, { damage: number; hp: number; reach: number }> = {
  wolf: { damage: 1.4, hp: 0.9, reach: 34 },
  boar: { damage: 1.1, hp: 1.0, reach: 34 },
  bear: { damage: 1.1, hp: 0.9, reach: 38 },
  lion: { damage: 1.0, hp: 1.2, reach: 38 },
};

/** penalidades do ferimento (vida e dano) */
export const INJURY_HP = 0.85;
export const INJURY_DAMAGE = 0.9;

/** Informação visual para a renderização (independente da lógica). */
export interface FighterVisual {
  appearance: Appearance;
  gear: Partial<Record<Slot, ItemDef>>;
  /** roupas extras (moradores da cidade): folha + tinta */
  extra?: Array<{ sheet: string; tint?: number }>;
  /** fera da venatio (leão, urso, lobo, javali): folha única no lugar das camadas */
  beast?: string;
}

/** Aplica os efeitos da árvore de habilidades sobre as estatísticas base. */
export function applyPerks(base: CombatStats, perks: string[]): CombatStats {
  const m = combinedMods(perks);
  const s = { ...base };
  s.maxHp = Math.round(s.maxHp * (1 + m.hpMul));
  s.critChance = Math.min(0.45, s.critChance + m.critAdd);
  s.dodgeChance = Math.min(DODGE_CAP, s.dodgeChance + m.dodgeAdd);
  s.attackInterval = Math.max(MIN_ATTACK_INTERVAL, s.attackInterval * (1 - m.intervalMul));
  s.staminaRegen *= 1 + m.regenMul;
  s.blockPower = Math.min(0.85, s.blockPower + m.blockAdd);
  s.damageMul = 1 + m.damageMul;
  s.damageTakenMul = 1 - m.damageTakenMul;
  s.hitBonus = m.hitAdd;
  s.blockPierce = m.blockPierce;
  s.powerStrikeBonus = m.powerStrikeBonus;
  s.secondWind = m.secondWind;
  return s;
}

export function playerCombatant(p: PlayerState): { spec: CombatantSpec; visual: FighterVisual } {
  const gear = equippedItems(p);
  const attrs = finalAttributes(naturalAttributes(p), gear);
  const stats = applyPerks(computeCombatStats(attrs, gear), p.perks);
  // ferido: menos vida e menos força nos golpes até sarar
  if (p.injury) {
    stats.maxHp = Math.round(stats.maxHp * INJURY_HP);
    stats.damageMul *= INJURY_DAMAGE;
  }
  return {
    spec: { name: p.name, level: p.level, stats, skills: skillsFromPerks(p.perks), strategy: p.strategy },
    visual: { appearance: p.appearance, gear },
  };
}

export function opponentGear(def: OpponentDef): Partial<Record<Slot, ItemDef>> {
  const gear: Partial<Record<Slot, ItemDef>> = {};
  for (const slot of SLOTS) {
    const id = def.equipment[slot];
    const item = id ? getItem(id) : undefined;
    if (item) gear[slot] = item;
  }
  return gear;
}

export function opponentPerks(def: OpponentDef): string[] {
  return autoPerks(def.level, def.paths, true);
}

export function opponentCombatant(def: OpponentDef): { spec: CombatantSpec; visual: FighterVisual } {
  const gear = opponentGear(def);
  const attrs = finalAttributes(opponentAttributes(def), gear);
  const perks = opponentPerks(def);
  const stats = applyPerks(computeCombatStats(attrs, gear), perks);
  const beast = def.beast ? BEAST_STATS[def.beast] : null;
  if (beast) {
    // feras: garras e presas no lugar da arma, quase não bloqueiam
    stats.damageMul *= beast.damage;
    stats.maxHp = Math.round(stats.maxHp * beast.hp);
    stats.blockPower = Math.min(stats.blockPower, 0.1);
    // alcance das garras/presas (sem arma o alcance não passaria do corpo do adversário)
    stats.reach = Math.max(stats.reach, beast.reach);
  }
  return {
    spec: { name: opponentFullName(def), level: def.level, stats, skills: skillsFromPerks(perks), strategy: def.strategy },
    visual: { appearance: def.appearance, gear, beast: def.beast },
  };
}
