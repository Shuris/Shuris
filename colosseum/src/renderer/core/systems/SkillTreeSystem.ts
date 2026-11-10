// Regras da árvore de habilidades: aprender, recomeçar e efeitos em combate.
import type { PlayerState, SkillId } from '../model/types';
import { PERKS, getPerk, type BranchId, type PerkMods } from '../data/skillTree';
import { SKILL_ORDER } from '../data/skills';
import { t } from '../../i18n';

/** Pontos de habilidade: 2 no início + 1 por nível ganho. */
export function skillPointsForLevel(level: number): number {
  return 1 + level;
}

export function canLearn(p: Pick<PlayerState, 'perks' | 'skillPoints'>, id: string): string | null {
  const perk = getPerk(id);
  if (!perk) return t('err.noPerk');
  if (p.perks.includes(id)) return 'Já aprendida.';
  if (perk.requires.length && !perk.requires.some((r) => p.perks.includes(r))) return t('err.perkPrev');
  if (p.skillPoints < perk.cost) return t('err.perkPoints', { n: perk.cost });
  return null;
}

export function learn(p: PlayerState, id: string): string | null {
  const err = canLearn(p, id);
  if (err) return err;
  p.skillPoints -= getPerk(id)!.cost;
  p.perks.push(id);
  return null;
}

export function respecCost(p: Pick<PlayerState, 'respecs' | 'level'>): number {
  return Math.round((50 + p.level * 10) * Math.pow(1.5, p.respecs));
}

/** Devolve todos os pontos (pago em moedas, custo crescente). */
export function respec(p: PlayerState): string | null {
  if (!p.perks.length) return t('err.nothingRespec');
  const cost = respecCost(p);
  if (p.coins < cost) return t('err.noCoins');
  p.coins -= cost;
  p.skillPoints += p.perks.reduce((s, id) => s + (getPerk(id)?.cost ?? 0), 0);
  p.perks = [];
  p.respecs++;
  return null;
}

export interface CombinedMods extends Required<Omit<PerkMods, 'secondWind'>> {
  secondWind: boolean;
}

export function combinedMods(perks: string[]): CombinedMods {
  const m: CombinedMods = {
    damageMul: 0, critAdd: 0, hpMul: 0, dodgeAdd: 0, intervalMul: 0, hitAdd: 0, regenMul: 0,
    blockAdd: 0, blockPierce: 0, damageTakenMul: 0, powerStrikeBonus: 0, secondWind: false,
  };
  for (const id of perks) {
    const mods = getPerk(id)?.mods;
    if (!mods) continue;
    for (const [k, v] of Object.entries(mods)) {
      if (k === 'secondWind') m.secondWind = m.secondWind || !!v;
      else (m as unknown as Record<string, number>)[k] += v as number;
    }
  }
  return m;
}

export function skillsFromPerks(perks: string[]): SkillId[] {
  const set = new Set(perks.map((id) => getPerk(id)?.skill).filter((s): s is SkillId => !!s));
  return SKILL_ORDER.filter((s) => set.has(s));
}

/**
 * Escolha automática de habilidades (adversários e simulações): segue a ordem
 * de caminhos preferida, sempre pegando o próximo nó disponível mais barato.
 */
export function autoPerks(level: number, order: BranchId[], spread = false): string[] {
  const state = { perks: [] as string[], skillPoints: skillPointsForLevel(level) };
  let progress = true;
  let turn = 0;
  while (progress) {
    progress = false;
    // "spread" alterna entre os caminhos (build equilibrada)
    const rotated = spread ? [...order.slice(turn % order.length), ...order.slice(0, turn % order.length)] : order;
    turn++;
    for (const branch of rotated) {
      const next = PERKS.filter((pk) => pk.branch === branch && !canLearn(state, pk.id)).sort((a, b) => a.tier - b.tier)[0];
      if (next) {
        state.skillPoints -= next.cost;
        state.perks.push(next.id);
        progress = true;
        break;
      }
    }
  }
  return state.perks;
}
