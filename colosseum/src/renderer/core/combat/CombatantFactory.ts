import type { Appearance, ItemDef, PlayerState, Slot } from '../model/types';
import { SLOTS } from '../model/types';
import type { CombatantSpec } from './CombatTypes';
import { computeCombatStats, equippedItems, finalAttributes, naturalAttributes } from '../systems/AttributeSystem';
import { skillsForLevel } from '../data/skills';
import { getItem } from '../data/equipment';
import { opponentAttributes, type OpponentDef } from '../data/opponents';

/** Informação visual para a renderização (independente da lógica). */
export interface FighterVisual {
  appearance: Appearance;
  gear: Partial<Record<Slot, ItemDef>>;
}

export function playerCombatant(p: PlayerState): { spec: CombatantSpec; visual: FighterVisual } {
  const gear = equippedItems(p);
  const attrs = finalAttributes(naturalAttributes(p), gear);
  return {
    spec: { name: p.name, level: p.level, stats: computeCombatStats(attrs, gear), skills: skillsForLevel(p.level), strategy: p.strategy },
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

export function opponentCombatant(def: OpponentDef): { spec: CombatantSpec; visual: FighterVisual } {
  const gear = opponentGear(def);
  const attrs = finalAttributes(opponentAttributes(def), gear);
  return {
    spec: { name: `${def.name}, ${def.epithet}`, level: def.level, stats: computeCombatStats(attrs, gear), skills: def.skills, strategy: def.strategy },
    visual: { appearance: def.appearance, gear },
  };
}
