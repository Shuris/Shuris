// Melhorias permanentes compradas no mercado: alojamento (descanso) e ludus (treino).
// Nomes e descrições ficam no dicionário de idiomas (upgrade.<id>.name/desc).
import type { PlayerState, TrainingId } from '../model/types';

export type UpgradeId = 'bed_wool' | 'bed_noble' | 'stone_weights' | 'sand_track' | 'agility_stakes' | 'iron_palus' | 'doctore';

export interface UpgradeDef {
  id: UpgradeId;
  place: 'home' | 'ludus';
  price: number;
  minLevel: number;
  requires?: UpgradeId;
  /** energia extra recuperada no cochilo */
  napBonus?: number;
  /** atributo que rende mais no treino e o multiplicador */
  training?: { id: TrainingId; mul: number };
  /** energia a menos por treino */
  trainEnergyCut?: number;
  icon: string;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'bed_wool', place: 'home', price: 180, minLevel: 1, napBonus: 12, icon: 'up_bed' },
  { id: 'bed_noble', place: 'home', price: 520, minLevel: 6, requires: 'bed_wool', napBonus: 25, icon: 'up_bed2' },
  { id: 'stone_weights', place: 'ludus', price: 220, minLevel: 2, training: { id: 'str', mul: 1.35 }, icon: 'up_weights' },
  { id: 'sand_track', place: 'ludus', price: 200, minLevel: 2, training: { id: 'res', mul: 1.35 }, icon: 'up_track' },
  { id: 'agility_stakes', place: 'ludus', price: 220, minLevel: 3, training: { id: 'agi', mul: 1.35 }, icon: 'up_stakes' },
  { id: 'iron_palus', place: 'ludus', price: 240, minLevel: 3, training: { id: 'tech', mul: 1.35 }, icon: 'up_palus' },
  { id: 'doctore', place: 'ludus', price: 650, minLevel: 8, trainEnergyCut: 3, icon: 'up_doctore' },
];

export function getUpgrade(id: string): UpgradeDef | undefined {
  return UPGRADES.find((u) => u.id === id);
}

export function hasUpgrade(p: PlayerState, id: UpgradeId): boolean {
  return p.upgrades.includes(id);
}

/** Energia recuperada num cochilo (cama melhor = mais energia; não acumulam). */
export function napBonus(p: PlayerState): number {
  return Math.max(0, ...UPGRADES.filter((u) => u.napBonus && hasUpgrade(p, u.id)).map((u) => u.napBonus as number));
}

export function trainingMul(p: PlayerState, id: TrainingId): number {
  return UPGRADES.filter((u) => u.training?.id === id && hasUpgrade(p, u.id)).reduce((m, u) => m * (u.training as { mul: number }).mul, 1);
}

export function trainEnergyCut(p: PlayerState): number {
  return UPGRADES.filter((u) => u.trainEnergyCut && hasUpgrade(p, u.id)).reduce((s, u) => s + (u.trainEnergyCut as number), 0);
}

export type UpgradeCheck = 'owned' | 'level' | 'requires' | 'coins' | null;

export function canBuyUpgrade(p: PlayerState, id: UpgradeId): UpgradeCheck {
  const u = getUpgrade(id);
  if (!u || hasUpgrade(p, id)) return 'owned';
  if (p.level < u.minLevel) return 'level';
  if (u.requires && !hasUpgrade(p, u.requires)) return 'requires';
  if (p.coins < u.price) return 'coins';
  return null;
}

export function buyUpgrade(p: PlayerState, id: UpgradeId): UpgradeCheck {
  const err = canBuyUpgrade(p, id);
  if (err) return err;
  p.coins -= (getUpgrade(id) as UpgradeDef).price;
  p.upgrades.push(id);
  return null;
}
