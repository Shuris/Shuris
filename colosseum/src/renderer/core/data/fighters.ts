// Tipos de gladiador (todos de combate corpo a corpo) e os lutadores avulsos da
// cidade: aparecem como desafiantes do dia na arena e nos torneios de sábado.
import type { Appearance, AttributeKey, Slot, StrategyId } from '../model/types';
import type { BranchId } from './skillTree';
import type { OpponentDef } from './opponents';
import { MAX_LEVEL } from './gladiators';
import { createRng, type Rng } from '../systems/rng';

export type FighterClass =
  | 'murmillo'
  | 'thraex'
  | 'hoplomachus'
  | 'secutor'
  | 'retiarius'
  | 'provocator'
  | 'dimachaerus'
  | 'scissor'
  | 'crupellarius';

export interface ClassDef {
  id: FighterClass;
  weights: Partial<Record<AttributeKey, number>>;
  strategy: StrategyId;
  paths: BranchId[];
  /** equipamento por faixa de nível: 1–5, 6–11, 12–18, 19+ */
  gear: Array<Partial<Record<Slot, string>>>;
  /** tipo novo (dimachaerus, scissor, provocator, crupellarius) */
  fresh?: boolean;
}

export const CLASSES: Record<FighterClass, ClassDef> = {
  murmillo: {
    id: 'murmillo', strategy: 'defensive', paths: ['minerva', 'mars', 'mercury'],
    weights: { str: 1.3, vit: 1.4, res: 1.6, agi: 0.6, prec: 1, tech: 1 },
    gear: [
      { mainHand: 'gladius', offHand: 'scutum', head: 'leather_cap' },
      { mainHand: 'gladius', offHand: 'scutum', head: 'galea', legs: 'greaves' },
      { mainHand: 'gladius_pompeii', offHand: 'scutum', head: 'murmillo_helm', body: 'medium_armor', legs: 'greaves' },
      { mainHand: 'gladius_mainz', offHand: 'reinforced_scutum', head: 'murmillo_helm', body: 'medium_armor', legs: 'bronze_greaves' },
    ],
  },
  thraex: {
    id: 'thraex', strategy: 'balanced', paths: ['mercury', 'mars', 'minerva'],
    weights: { str: 1.2, vit: 1.1, res: 0.9, agi: 1.5, prec: 1.1, tech: 1.2 },
    gear: [
      { mainHand: 'short_sword', offHand: 'parmula' },
      { mainHand: 'sica', offHand: 'parmula', head: 'galea', legs: 'greaves' },
      { mainHand: 'sica', offHand: 'thracian_parma', head: 'galea', body: 'light_armor', legs: 'bronze_greaves' },
      { mainHand: 'sica', offHand: 'thracian_parma', head: 'galea', body: 'light_armor', legs: 'ornate_greaves' },
    ],
  },
  hoplomachus: {
    id: 'hoplomachus', strategy: 'balanced', paths: ['mercury', 'mars', 'minerva'],
    weights: { str: 1.2, vit: 1.1, res: 1, agi: 1.1, prec: 1.5, tech: 0.9 },
    gear: [
      { mainHand: 'spear', offHand: 'parmula' },
      { mainHand: 'spear', offHand: 'parmula', head: 'galea', legs: 'greaves' },
      { mainHand: 'hoplomachus_spear', offHand: 'parmula', head: 'galea', body: 'light_armor', legs: 'bronze_greaves' },
      { mainHand: 'hoplomachus_spear', offHand: 'thracian_parma', head: 'galea', body: 'medium_armor', legs: 'ornate_greaves' },
    ],
  },
  secutor: {
    id: 'secutor', strategy: 'balanced', paths: ['minerva', 'mars', 'mercury'],
    weights: { str: 1.4, vit: 1.4, res: 1.4, agi: 0.6, prec: 1, tech: 0.8 },
    gear: [
      { mainHand: 'gladius', offHand: 'parmula', head: 'leather_cap' },
      { mainHand: 'gladius', offHand: 'scutum', head: 'secutor_helm' },
      { mainHand: 'gladius_pompeii', offHand: 'scutum', head: 'secutor_helm', legs: 'bronze_greaves' },
      { mainHand: 'gladius_mainz', offHand: 'reinforced_scutum', head: 'secutor_helm', body: 'medium_armor', legs: 'ornate_greaves' },
    ],
  },
  retiarius: {
    id: 'retiarius', strategy: 'balanced', paths: ['mercury', 'minerva', 'mars'],
    weights: { str: 1, vit: 1.1, res: 0.8, agi: 1.6, prec: 1.3, tech: 1 },
    gear: [
      { mainHand: 'spear' },
      { mainHand: 'trident', legs: 'greaves' },
      { mainHand: 'trident', body: 'light_armor', legs: 'bronze_greaves' },
      { mainHand: 'champion_trident', body: 'light_armor', legs: 'ornate_greaves' },
    ],
  },
  provocator: {
    id: 'provocator', strategy: 'balanced', paths: ['minerva', 'mars', 'mercury'], fresh: true,
    weights: { str: 1.3, vit: 1.3, res: 1.3, agi: 0.9, prec: 1.1, tech: 1 },
    gear: [
      { mainHand: 'gladius', offHand: 'parmula', body: 'cardiophylax' },
      { mainHand: 'gladius', offHand: 'scutum', head: 'provocator_helm', body: 'cardiophylax' },
      { mainHand: 'gladius_pompeii', offHand: 'scutum', head: 'provocator_helm', body: 'cardiophylax', legs: 'greaves' },
      { mainHand: 'gladius_mainz', offHand: 'reinforced_scutum', head: 'provocator_helm', body: 'bronze_cuirass', legs: 'bronze_greaves' },
    ],
  },
  dimachaerus: {
    id: 'dimachaerus', strategy: 'aggressive', paths: ['mars', 'mercury', 'minerva'], fresh: true,
    weights: { str: 1.3, vit: 1, res: 0.8, agi: 1.6, prec: 1.2, tech: 0.9 },
    gear: [
      { mainHand: 'short_sword', offHand: 'twin_gladius' },
      { mainHand: 'gladius', offHand: 'twin_gladius', head: 'leather_cap', legs: 'greaves' },
      { mainHand: 'sica', offHand: 'twin_gladius', head: 'galea', body: 'light_armor', legs: 'greaves' },
      { mainHand: 'gladius_mainz', offHand: 'twin_gladius', head: 'galea', body: 'light_armor', legs: 'ornate_greaves' },
    ],
  },
  scissor: {
    id: 'scissor', strategy: 'aggressive', paths: ['mars', 'minerva', 'mercury'], fresh: true,
    weights: { str: 1.5, vit: 1.3, res: 1.2, agi: 0.8, prec: 1, tech: 1.1 },
    gear: [
      { mainHand: 'gladius', body: 'light_armor' },
      { mainHand: 'arbelas', head: 'secutor_helm', body: 'light_armor' },
      { mainHand: 'arbelas', head: 'secutor_helm', body: 'medium_armor', legs: 'greaves' },
      { mainHand: 'arbelas', head: 'secutor_helm', body: 'scale_armor', legs: 'bronze_greaves' },
    ],
  },
  crupellarius: {
    id: 'crupellarius', strategy: 'defensive', paths: ['minerva', 'mars', 'mercury'], fresh: true,
    weights: { str: 1.4, vit: 1.5, res: 1.8, agi: 0.4, prec: 0.9, tech: 0.9 },
    gear: [
      { mainHand: 'gladius', offHand: 'parmula', body: 'medium_armor' },
      { mainHand: 'gladius', offHand: 'parmula', head: 'galea', body: 'medium_armor', legs: 'greaves' },
      { mainHand: 'gladius_pompeii', offHand: 'parmula', head: 'crupellarius_helm', body: 'scale_armor', legs: 'bronze_greaves' },
      { mainHand: 'gladius_mainz', offHand: 'thracian_parma', head: 'crupellarius_helm', body: 'scale_armor', legs: 'ornate_greaves' },
    ],
  },
};

export interface PoolFighter {
  id: string;
  name: string;
  cls: FighterClass;
  appearance: Appearance;
}

/** Lutadores avulsos da cidade (desafiantes do dia e competidores de torneio). */
export const POOL: PoolFighter[] = [
  { id: 'pool_aulus', name: 'Aulus', cls: 'murmillo', appearance: { skin: 0, hairStyle: 0, hairColor: 0, beard: true, clothColor: 0 } },
  { id: 'pool_tetraites', name: 'Tetraites', cls: 'dimachaerus', appearance: { skin: 1, hairStyle: 2, hairColor: 2, beard: false, clothColor: 4 } },
  { id: 'pool_celadus', name: 'Celadus', cls: 'thraex', appearance: { skin: 0, hairStyle: 1, hairColor: 3, beard: false, clothColor: 2 } },
  { id: 'pool_ursus', name: 'Ursus', cls: 'crupellarius', appearance: { skin: 0, hairStyle: 1, hairColor: 4, beard: true, clothColor: 3 } },
  { id: 'pool_hermes', name: 'Hermes', cls: 'retiarius', appearance: { skin: 1, hairStyle: 0, hairColor: 2, beard: false, clothColor: 1 } },
  { id: 'pool_draco', name: 'Draco', cls: 'scissor', appearance: { skin: 2, hairStyle: 2, hairColor: 2, beard: true, clothColor: 0 } },
  { id: 'pool_felix', name: 'Felix', cls: 'provocator', appearance: { skin: 1, hairStyle: 0, hairColor: 1, beard: false, clothColor: 4 } },
  { id: 'pool_columbus', name: 'Columbus', cls: 'secutor', appearance: { skin: 0, hairStyle: 0, hairColor: 5, beard: true, clothColor: 5 } },
  { id: 'pool_tigris', name: 'Tigris', cls: 'dimachaerus', appearance: { skin: 2, hairStyle: 1, hairColor: 2, beard: false, clothColor: 5 } },
  { id: 'pool_decimus', name: 'Decimus', cls: 'hoplomachus', appearance: { skin: 1, hairStyle: 0, hairColor: 0, beard: true, clothColor: 2 } },
  { id: 'pool_varro', name: 'Varro', cls: 'provocator', appearance: { skin: 0, hairStyle: 2, hairColor: 1, beard: true, clothColor: 1 } },
  { id: 'pool_nubia', name: 'Juba', cls: 'scissor', appearance: { skin: 2, hairStyle: 0, hairColor: 2, beard: true, clothColor: 3 } },
  { id: 'pool_sextus', name: 'Sextus', cls: 'murmillo', appearance: { skin: 1, hairStyle: 1, hairColor: 0, beard: false, clothColor: 0 } },
  { id: 'pool_brennus', name: 'Brennus', cls: 'crupellarius', appearance: { skin: 0, hairStyle: 1, hairColor: 3, beard: true, clothColor: 2 } },
  { id: 'pool_atticus', name: 'Atticus', cls: 'thraex', appearance: { skin: 1, hairStyle: 2, hairColor: 2, beard: true, clothColor: 4 } },
  { id: 'pool_titus', name: 'Titus', cls: 'secutor', appearance: { skin: 2, hairStyle: 0, hairColor: 2, beard: false, clothColor: 5 } },
];

export function getPoolFighter(id: string): PoolFighter | undefined {
  return POOL.find((f) => f.id === id);
}

export function gearTier(level: number): number {
  return level <= 5 ? 0 : level <= 11 ? 1 : level <= 18 ? 2 : 3;
}

/** Ficha de combate de um lutador avulso no nível pedido. */
export function poolOpponent(f: PoolFighter, level: number): OpponentDef {
  const c = CLASSES[f.cls];
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.round(level)));
  return {
    id: f.id,
    name: f.name,
    epithet: '',
    description: '',
    level: lv,
    weights: c.weights,
    equipment: c.gear[gearTier(lv)],
    strategy: c.strategy,
    paths: c.paths,
    appearance: f.appearance,
    cls: f.cls,
  };
}

/** Semente estável por gladiador e dia (eventos e desafiantes não mudam ao recarregar). */
export function daySeed(seed: number, day: number, salt: number): number {
  return (seed ^ Math.imul(day + 7, 2246822519) ^ Math.imul(salt + 3, 3266489917)) >>> 0;
}

/**
 * Desafiante avulso: cada luta do dia é contra alguém diferente, do nível do
 * jogador (com pequena variação). Revanche só existe quando o adversário pede.
 */
export function freeChallenger(seed: number, day: number, index: number, playerLevel: number): OpponentDef {
  const rng = createRng(daySeed(seed, day, 100 + index));
  const f = POOL[Math.floor(rng() * POOL.length)];
  const level = playerLevel + (rng() < 0.35 ? 1 : 0) - (rng() < 0.25 ? 1 : 0);
  return poolOpponent(f, level);
}

/** Embaralha (Fisher-Yates) com o gerador dado. */
export function shuffle<T>(rng: Rng, list: readonly T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
