import type { Attributes, AttributeKey, ItemDef, PlayerState, Slot } from '../model/types';
import { ATTRIBUTE_KEYS, SLOTS } from '../model/types';
import { MAX_ATTRIBUTE, emptyAttributes } from '../data/gladiators';
import { getItem } from '../data/equipment';
import { clamp } from './rng';
import { t } from '../../i18n';

/** Estatísticas de combate derivadas de atributos + equipamentos. */
export interface CombatStats {
  maxHp: number;
  maxStamina: number;
  baseDamage: number;
  defense: number;
  damageReduction: number;
  precision: number;
  agility: number;
  technique: number;
  dodgeChance: number;
  attackInterval: number;
  reach: number;
  blockPower: number;
  hasShield: boolean;
  critChance: number;
  /** defesa do alvo ignorada (golpes nas brechas da armadura) */
  armorPierce: number;
  moveSpeed: number;
  staminaRegen: number;
  /** multiplicador aplicado aos custos de resistência (menor = menos fadiga) */
  fatigueMul: number;
  /** efeitos da árvore de habilidades */
  damageMul: number;
  damageTakenMul: number;
  hitBonus: number;
  blockPierce: number;
  powerStrikeBonus: number;
  secondWind: boolean;
}

export const DODGE_CAP = 0.35;
export const MIN_ATTACK_INTERVAL = 0.8;
export const BASE_ATTACK_INTERVAL = 2.0;
export const UNARMED_REACH = 16;
export const PARRY_POWER = 0.2;

export function equippedItems(player: Pick<PlayerState, 'equipment' | 'inventory'>): Partial<Record<Slot, ItemDef>> {
  const out: Partial<Record<Slot, ItemDef>> = {};
  for (const slot of SLOTS) {
    const uid = player.equipment[slot];
    if (!uid) continue;
    const inv = player.inventory.find((i) => i.uid === uid);
    const def = inv ? getItem(inv.itemId) : undefined;
    if (def) out[slot] = def;
  }
  return out;
}

export function gearAttributeBonus(gear: Partial<Record<Slot, ItemDef>>): Attributes {
  const b = emptyAttributes();
  for (const item of Object.values(gear)) {
    if (!item?.mods.attrs) continue;
    for (const k of ATTRIBUTE_KEYS) b[k] += item.mods.attrs[k] ?? 0;
  }
  return b;
}

/** Atributos sem equipamento: base distribuída + bônus de treinamento. */
export function naturalAttributes(player: Pick<PlayerState, 'baseAttributes' | 'trainedBonus'>): Attributes {
  const a = emptyAttributes();
  for (const k of ATTRIBUTE_KEYS) a[k] = clamp(player.baseAttributes[k] + player.trainedBonus[k], 0, MAX_ATTRIBUTE);
  return a;
}

/** Atributos finais (nunca negativos). */
export function finalAttributes(natural: Attributes, gear: Partial<Record<Slot, ItemDef>>): Attributes {
  const bonus = gearAttributeBonus(gear);
  const a = emptyAttributes();
  for (const k of ATTRIBUTE_KEYS) a[k] = clamp(natural[k] + bonus[k], 0, MAX_ATTRIBUTE + 20);
  return a;
}

export function computeCombatStats(attrs: Attributes, gear: Partial<Record<Slot, ItemDef>>): CombatStats {
  let weaponDamage = 0;
  let defense = 0;
  let speed = 0;
  let reach = UNARMED_REACH;
  let block = 0;
  for (const item of Object.values(gear)) {
    if (!item) continue;
    weaponDamage += item.mods.damage ?? 0;
    defense += item.mods.defense ?? 0;
    speed += item.mods.attackSpeed ?? 0;
    if (item.slot === 'mainHand' && item.mods.reach) reach = item.mods.reach;
    if (item.slot === 'offHand' && item.mods.block) block = item.mods.block;
  }
  const totalDefense = defense + attrs.res * 1.5;
  const hasShield = block > 0;
  return {
    maxHp: Math.round(100 + attrs.vit * 12),
    maxStamina: Math.round(100 + attrs.res * 10),
    baseDamage: 8 + attrs.str * 1.8 + weaponDamage,
    defense: totalDefense,
    damageReduction: Math.min(0.7, totalDefense / (totalDefense + 100)),
    precision: attrs.prec,
    agility: attrs.agi,
    technique: attrs.tech,
    dodgeChance: Math.min(DODGE_CAP, 0.05 + attrs.agi * 0.005),
    attackInterval: clamp(BASE_ATTACK_INTERVAL - attrs.agi * 0.032 + speed, MIN_ATTACK_INTERVAL, 3),
    reach,
    blockPower: clamp((hasShield ? block : PARRY_POWER) + attrs.tech * 0.002, 0, 0.85),
    hasShield,
    critChance: Math.min(0.35, 0.04 + attrs.tech * 0.002 + attrs.prec * 0.006),
    armorPierce: attrs.prec * 1.0,
    moveSpeed: 34 + attrs.agi * 0.5,
    staminaRegen: 3 + attrs.res * 0.1,
    fatigueMul: 1 / (1 + attrs.res * 0.015),
    damageMul: 1,
    damageTakenMul: 1,
    hitBonus: 0,
    blockPierce: 0,
    powerStrikeBonus: 0,
    secondWind: false,
  };
}

export function playerCombatStats(player: PlayerState): { attrs: Attributes; stats: CombatStats } {
  const gear = equippedItems(player);
  const attrs = finalAttributes(naturalAttributes(player), gear);
  return { attrs, stats: computeCombatStats(attrs, gear) };
}

/** Aplica pontos de atributo. Retorna erro em texto ou null em caso de sucesso. */
export function allocatePoints(player: PlayerState, alloc: Partial<Record<AttributeKey, number>>): string | null {
  let total = 0;
  for (const k of ATTRIBUTE_KEYS) {
    const v = alloc[k] ?? 0;
    if (!Number.isInteger(v) || v < 0) return t('err.badAlloc');
    if (player.baseAttributes[k] + player.trainedBonus[k] + v > MAX_ATTRIBUTE) return t('err.attrMax');
    total += v;
  }
  if (total === 0) return t('err.noPoints');
  if (total > player.unspentPoints) return t('err.notEnoughPoints');
  for (const k of ATTRIBUTE_KEYS) player.baseAttributes[k] += alloc[k] ?? 0;
  player.unspentPoints -= total;
  return null;
}
