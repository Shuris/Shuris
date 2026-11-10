// Árvore de habilidades: três caminhos inspirados em deuses romanos.
import type { SkillId } from '../model/types';

export type BranchId = 'mars' | 'mercury' | 'minerva';

export interface PerkMods {
  damageMul?: number; // +% dano causado (0,06 = +6%)
  critAdd?: number; // + chance de crítico
  hpMul?: number; // +% vida
  dodgeAdd?: number; // + esquiva (limite continua 35%)
  intervalMul?: number; // −% intervalo de ataque (0,08 = 8% mais rápido)
  hitAdd?: number; // + chance de acerto
  regenMul?: number; // +% recuperação de fôlego
  blockAdd?: number; // + eficiência de bloqueio
  blockPierce?: number; // ignora parte do bloqueio inimigo
  damageTakenMul?: number; // −% dano recebido
  powerStrikeBonus?: number; // + multiplicador do Golpe poderoso
  secondWind?: boolean; // recupera vida uma vez por luta
}

export interface PerkDef {
  id: string;
  branch: BranchId;
  tier: number; // 1..5
  name: string;
  short: string;
  cost: number;
  requires: string[]; // basta UM dos pré-requisitos
  skill?: SkillId;
  mods?: PerkMods;
  icon: string;
}

export const BRANCHES: Record<BranchId, { name: string; subtitle: string; color: string }> = {
  mars: { name: 'Marte', subtitle: 'Ataque', color: '#e0584a' },
  mercury: { name: 'Mercúrio', subtitle: 'Velocidade', color: '#6ab0ff' },
  minerva: { name: 'Minerva', subtitle: 'Defesa', color: '#8ad866' },
};

export const PERKS: PerkDef[] = [
  // ---------------- MARTE
  { id: 'm1', branch: 'mars', tier: 1, name: 'Braço forte', short: '+5% de dano', cost: 1, requires: [], mods: { damageMul: 0.05 }, icon: 'attr_str' },
  { id: 'm2', branch: 'mars', tier: 2, name: 'Golpe poderoso', short: 'Habilidade: golpe muito forte', cost: 1, requires: ['m1'], skill: 'power_strike', icon: 'skill_power_strike' },
  { id: 'm3a', branch: 'mars', tier: 3, name: 'Fúria', short: '+4% de crítico', cost: 2, requires: ['m2'], mods: { critAdd: 0.04 }, icon: 'attr_prec' },
  { id: 'm3b', branch: 'mars', tier: 3, name: 'Peso do golpe', short: 'Golpe poderoso +25%', cost: 2, requires: ['m2'], mods: { powerStrikeBonus: 0.25 }, icon: 'skill_power_strike' },
  { id: 'm4', branch: 'mars', tier: 4, name: 'Quebra-guarda', short: 'Ignora 12% do bloqueio', cost: 2, requires: ['m3a', 'm3b'], mods: { blockPierce: 0.12 }, icon: 'attr_tech' },
  { id: 'm5', branch: 'mars', tier: 5, name: 'Ira de Marte', short: '+8% dano, +4% crítico', cost: 3, requires: ['m4'], mods: { damageMul: 0.08, critAdd: 0.04 }, icon: 'attr_str' },
  // ---------------- MERCÚRIO
  { id: 'v1', branch: 'mercury', tier: 1, name: 'Pés leves', short: '+4% de esquiva', cost: 1, requires: [], mods: { dodgeAdd: 0.04 }, icon: 'attr_agi' },
  { id: 'v2', branch: 'mercury', tier: 2, name: 'Ataque rápido', short: 'Habilidade: golpe veloz', cost: 1, requires: ['v1'], skill: 'quick_strike', icon: 'skill_quick_strike' },
  { id: 'v3a', branch: 'mercury', tier: 3, name: 'Ritmo', short: 'Ataca 8% mais rápido', cost: 2, requires: ['v2'], mods: { intervalMul: 0.08 }, icon: 'attr_agi' },
  { id: 'v3b', branch: 'mercury', tier: 3, name: 'Olhos de águia', short: '+6% de acerto', cost: 2, requires: ['v2'], mods: { hitAdd: 0.06 }, icon: 'attr_prec' },
  { id: 'v4', branch: 'mercury', tier: 4, name: 'Contra-ataque', short: 'Habilidade: revida após defender', cost: 2, requires: ['v3a', 'v3b'], skill: 'counter', icon: 'skill_counter' },
  { id: 'v5', branch: 'mercury', tier: 5, name: 'Asas de Mercúrio', short: '+5% esquiva, 8% mais rápido', cost: 3, requires: ['v4'], mods: { dodgeAdd: 0.05, intervalMul: 0.08 }, icon: 'attr_agi' },
  // ---------------- MINERVA
  { id: 'd1', branch: 'minerva', tier: 1, name: 'Pele dura', short: '+6% de vida', cost: 1, requires: [], mods: { hpMul: 0.06 }, icon: 'attr_vit' },
  { id: 'd2', branch: 'minerva', tier: 2, name: 'Defesa reforçada', short: 'Habilidade: reduz o dano', cost: 1, requires: ['d1'], skill: 'iron_guard', icon: 'skill_iron_guard' },
  { id: 'd3a', branch: 'minerva', tier: 3, name: 'Fôlego de ferro', short: '+25% de fôlego', cost: 2, requires: ['d2'], mods: { regenMul: 0.25 }, icon: 'attr_res' },
  { id: 'd3b', branch: 'minerva', tier: 3, name: 'Muralha', short: '+6% de bloqueio', cost: 2, requires: ['d2'], mods: { blockAdd: 0.06 }, icon: 'skill_iron_guard' },
  { id: 'd4', branch: 'minerva', tier: 4, name: 'Segundo fôlego', short: 'Recupera vida 1x por luta', cost: 2, requires: ['d3a', 'd3b'], mods: { secondWind: true }, icon: 'attr_vit' },
  { id: 'd5', branch: 'minerva', tier: 5, name: 'Escudo de Minerva', short: '−8% dano, +8% vida', cost: 3, requires: ['d4'], mods: { damageTakenMul: 0.08, hpMul: 0.08 }, icon: 'attr_res' },
];

const BY_ID = new Map(PERKS.map((p) => [p.id, p]));

export function getPerk(id: string): PerkDef | undefined {
  return BY_ID.get(id);
}
