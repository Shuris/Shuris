import type { Appearance, Attributes, AttributeKey, Slot, StrategyId } from '../model/types';
import type { BranchId } from './skillTree';
import { ATTRIBUTE_KEYS } from '../model/types';
import { BASE_ATTRIBUTE, POINTS_PER_LEVEL } from './gladiators';

export interface OpponentDef {
  id: string;
  name: string;
  epithet: string;
  description: string;
  level: number;
  /** peso relativo de cada atributo na distribuição de pontos */
  weights: Partial<Record<AttributeKey, number>>;
  equipment: Partial<Record<Slot, string>>;
  strategy: StrategyId;
  /** ordem de preferência dos caminhos da árvore de habilidades */
  paths: BranchId[];
  appearance: Appearance;
  /** tipo de gladiador (lutadores avulsos) */
  cls?: string;
  /** fera da venatio (sem equipamento: garras e presas) */
  beast?: string;
}

export const OPPONENTS: OpponentDef[] = [
  {
    id: 'marcus', name: 'Marcus', epithet: 'o Novato', level: 1,
    description: 'Recruta recém-chegado ao ludus. Luta com uma rúdis de madeira e pouca experiência.',
    weights: { str: 1, vit: 1, res: 1, agi: 1, prec: 1, tech: 0.5 },
    equipment: { mainHand: 'rudis' }, strategy: 'balanced', paths: ['mars', 'minerva', 'mercury'],
    appearance: { skin: 0, hairStyle: 0, hairColor: 1, beard: false, clothColor: 1 },
  },
  {
    id: 'cassius', name: 'Cassius', epithet: 'o Andabata', level: 3,
    description: 'Lutador impetuoso que ataca sem parar. Rápido, porém descuidado na defesa.',
    weights: { str: 1.2, vit: 0.8, res: 0.6, agi: 1.6, prec: 1, tech: 0.5 },
    equipment: { mainHand: 'short_sword', offHand: 'parmula', head: 'leather_cap' }, strategy: 'aggressive',
    paths: ['mercury', 'mars', 'minerva'],
    appearance: { skin: 1, hairStyle: 2, hairColor: 2, beard: true, clothColor: 0 },
  },
  {
    id: 'rufus', name: 'Rufus', epithet: 'o Retiário', level: 5,
    description: 'Retiário ágil que usa o alcance do tridente para manter os rivais à distância.',
    weights: { str: 1.1, vit: 1.2, res: 0.8, agi: 1.5, prec: 1.2, tech: 0.8 },
    equipment: { mainHand: 'trident', body: 'light_armor', legs: 'greaves' }, strategy: 'balanced',
    paths: ['mercury', 'minerva', 'mars'],
    appearance: { skin: 2, hairStyle: 1, hairColor: 2, beard: false, clothColor: 2 },
  },
  {
    id: 'brutus', name: 'Brutus', epithet: 'o Secutor', level: 8,
    description: 'Secutor pesado e paciente, protegido por um grande scutum.',
    weights: { str: 1.5, vit: 1.4, res: 1.4, agi: 0.5, prec: 0.9, tech: 0.7 },
    equipment: { mainHand: 'gladius', offHand: 'scutum', head: 'galea', legs: 'greaves' }, strategy: 'balanced',
    paths: ['minerva', 'mars', 'mercury'],
    appearance: { skin: 0, hairStyle: 0, hairColor: 2, beard: true, clothColor: 0 },
  },
  {
    id: 'spiculus', name: 'Spiculus', epithet: 'o Hoplômaco', level: 11,
    description: 'Hoplômaco preciso, famoso pelas estocadas de lança à longa distância.',
    weights: { str: 1.3, vit: 1.2, res: 1, agi: 1.1, prec: 1.4, tech: 0.8 },
    equipment: { mainHand: 'spear', offHand: 'parmula', head: 'galea', body: 'light_armor', legs: 'bronze_greaves' },
    strategy: 'balanced', paths: ['mercury', 'mars', 'minerva'],
    appearance: { skin: 1, hairStyle: 0, hairColor: 0, beard: false, clothColor: 4 },
  },
  {
    id: 'crixus', name: 'Crixus', epithet: 'o Gaulês', level: 14,
    description: 'Gigante gaulês de força brutal. Prefere terminar as lutas rapidamente.',
    weights: { str: 1.8, vit: 1.5, res: 1.1, agi: 0.7, prec: 0.9, tech: 0.6 },
    equipment: { mainHand: 'gladius_pompeii', offHand: 'scutum', head: 'leather_cap', body: 'medium_armor', legs: 'greaves' },
    strategy: 'aggressive', paths: ['mars', 'minerva', 'mercury'],
    appearance: { skin: 0, hairStyle: 1, hairColor: 4, beard: true, clothColor: 3 },
  },
  {
    id: 'verus', name: 'Verus', epithet: 'o Trácio', level: 18,
    description: 'Trácio veterano, veloz e técnico, que pune cada erro com contra-ataques.',
    weights: { str: 1.3, vit: 1.2, res: 0.9, agi: 1.5, prec: 1.1, tech: 1.2 },
    equipment: { mainHand: 'sica', offHand: 'thracian_parma', head: 'galea', body: 'light_armor', legs: 'bronze_greaves' },
    strategy: 'balanced', paths: ['mercury', 'mars', 'minerva'],
    appearance: { skin: 1, hairStyle: 2, hairColor: 0, beard: true, clothColor: 5 },
  },
  {
    id: 'priscus', name: 'Priscus', epithet: 'o Mirmilão', level: 22,
    description: 'Mirmilão de defesa quase impenetrável. Espera o cansaço do rival para atacar.',
    weights: { str: 1.3, vit: 1.4, res: 1.8, agi: 0.6, prec: 1, tech: 1.1 },
    equipment: { mainHand: 'gladius_mainz', offHand: 'reinforced_scutum', head: 'murmillo_helm', body: 'medium_armor', legs: 'ornate_greaves' },
    strategy: 'defensive', paths: ['minerva', 'mars', 'mercury'],
    appearance: { skin: 2, hairStyle: 0, hairColor: 2, beard: true, clothColor: 1 },
  },
  {
    id: 'flamma', name: 'Flamma', epithet: 'o Campeão', level: 27,
    description: 'O campeão de Roma, invicto há anos. Domina todas as técnicas da arena.',
    weights: { str: 1.4, vit: 1.3, res: 1.2, agi: 1.1, prec: 1.2, tech: 1.3 },
    equipment: { mainHand: 'champion_gladius', offHand: 'champion_scutum', head: 'champion_helm', body: 'bronze_cuirass', legs: 'ornate_greaves' },
    strategy: 'balanced', paths: ['mars', 'minerva', 'mercury'],
    appearance: { skin: 1, hairStyle: 0, hairColor: 0, beard: false, clothColor: 4 },
  },
];

export function getOpponent(id: string): OpponentDef | undefined {
  return OPPONENTS.find((o) => o.id === id);
}

/** Adversário de revanche: treinou enquanto esperava (até 3 níveis a mais). */
export function rematchBoost(askedDay: number, day: number): number {
  return Math.min(3, 1 + Math.floor(Math.max(0, day - askedDay) / 2));
}

export function withLevel(def: OpponentDef, level: number): OpponentDef {
  return { ...def, level };
}

export function opponentIndex(id: string): number {
  return OPPONENTS.findIndex((o) => o.id === id);
}

/**
 * Pontos totais equivalentes aos de um jogador do mesmo nível
 * (origem + níveis + uma estimativa de treinamento).
 */
export function opponentAttributes(def: OpponentDef): Attributes {
  const extra = 3 + POINTS_PER_LEVEL * (def.level - 1) + Math.round(def.level * 0.5);
  const totalWeight = ATTRIBUTE_KEYS.reduce((s, k) => s + (def.weights[k] ?? 0), 0);
  const attrs = {} as Attributes;
  let assigned = 0;
  const fracs: Array<[AttributeKey, number]> = [];
  for (const k of ATTRIBUTE_KEYS) {
    const share = (extra * (def.weights[k] ?? 0)) / totalWeight;
    const whole = Math.floor(share);
    attrs[k] = BASE_ATTRIBUTE + whole;
    assigned += whole;
    fracs.push([k, share - whole]);
  }
  fracs.sort((a, b) => b[1] - a[1]);
  for (let i = 0; i < extra - assigned; i++) attrs[fracs[i % fracs.length][0]] += 1;
  return attrs;
}
