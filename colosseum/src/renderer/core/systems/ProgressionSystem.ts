import type { BattleRecord, PlayerState, Rarity, StrategyId } from '../model/types';
import { MAX_LEVEL, POINTS_PER_LEVEL } from '../data/gladiators';
import { ITEMS } from '../data/equipment';
import { OPPONENTS, opponentIndex, type OpponentDef } from '../data/opponents';
import { addItem } from './EquipmentSystem';
import { pick, type Rng } from './rng';

export const HISTORY_LIMIT = 50;

/** Experiência necessária para passar do nível L para L+1. */
export function xpToNext(level: number): number {
  if (level >= MAX_LEVEL) return Infinity;
  return Math.round(50 * Math.pow(level, 1.4) + 50);
}

/** Fator de recompensa conforme a diferença de nível (evita farmar adversários fracos). */
export function levelDiffFactor(playerLevel: number, opponentLevel: number): number {
  const diff = opponentLevel - playerLevel;
  if (diff >= 0) return Math.min(1.5, 1 + diff * 0.08);
  return Math.max(0.2, 1 + diff * 0.15);
}

export function isUnlocked(p: PlayerState, opponentId: string): boolean {
  const idx = opponentIndex(opponentId);
  if (idx <= 0) return idx === 0;
  return p.defeatedOpponents.includes(OPPONENTS[idx - 1].id);
}

export function unlockedOpponents(p: PlayerState): OpponentDef[] {
  return OPPONENTS.filter((o) => isUnlocked(p, o.id));
}

const DROP_TABLES: Array<[number, Record<Rarity, number>]> = [
  [2, { common: 70, uncommon: 30, rare: 0, epic: 0 }],
  [5, { common: 25, uncommon: 50, rare: 25, epic: 0 }],
  [7, { common: 0, uncommon: 35, rare: 55, epic: 10 }],
  [99, { common: 0, uncommon: 0, rare: 60, epic: 40 }],
];

export function rollDrop(opponentIdx: number, rng: Rng): string {
  const table = DROP_TABLES.find(([max]) => opponentIdx <= max)![1];
  const total = Object.values(table).reduce((a, b) => a + b, 0);
  let r = rng() * total;
  let rarity: Rarity = 'common';
  for (const [k, w] of Object.entries(table) as Array<[Rarity, number]>) {
    if (r < w) {
      rarity = k;
      break;
    }
    r -= w;
  }
  const pool = ITEMS.filter((i) => i.rarity === rarity && i.id !== 'rudis');
  return pick(rng, pool).id;
}

export interface BattleRewards {
  result: 'win' | 'loss';
  xp: number;
  coins: number;
  reputation: number;
  itemId: string | null;
  levelUps: number;
  newLevel: number;
  pointsGained: number;
  unlockedOpponent: OpponentDef | null;
  firstVictory: boolean;
}

export function computeRewards(p: PlayerState, opp: OpponentDef, won: boolean, rng: Rng) {
  const f = levelDiffFactor(p.level, opp.level);
  const firstVictory = won && !p.defeatedOpponents.includes(opp.id);
  if (!won) {
    return { xp: Math.max(5, Math.round((30 + 12 * opp.level) * f * 0.2)), coins: 5 + opp.level, reputation: 0, itemId: null, firstVictory };
  }
  const xp = Math.round((30 + 12 * opp.level) * f);
  const coins = Math.round((20 + 8 * opp.level) * f) + (firstVictory ? 25 + opp.level * 10 : 0);
  const reputation = Math.max(1, Math.round((2 + opp.level) * Math.min(1, f))) + (firstVictory ? 5 : 0);
  const dropChance = firstVictory ? 1 : 0.2;
  const itemId = rng() < dropChance ? rollDrop(opponentIndex(opp.id), rng) : null;
  return { xp, coins, reputation, itemId, firstVictory };
}

/** Concede experiência e processa evoluções de nível. Retorna nº de níveis ganhos. */
export function grantXp(p: PlayerState, amount: number): number {
  let ups = 0;
  if (p.level >= MAX_LEVEL) return 0;
  p.xp += Math.max(0, Math.round(amount));
  while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    p.unspentPoints += POINTS_PER_LEVEL;
    ups++;
  }
  if (p.level >= MAX_LEVEL) p.xp = 0;
  return ups;
}

export interface BattleOutcomeInput {
  opponent: OpponentDef;
  won: boolean;
  reason: 'ko' | 'decision' | 'forfeit';
  duration: number;
  strategy: StrategyId;
  rng: Rng;
  now?: number;
}

/** Aplica o resultado de uma batalha ao jogador (vitória ou derrota — sem perdas). */
export function applyBattleResult(p: PlayerState, input: BattleOutcomeInput): BattleRewards {
  const { opponent: opp, won, rng } = input;
  const playerLevelBefore = p.level;
  const r = computeRewards(p, opp, won, rng);
  const levelUps = grantXp(p, r.xp);
  p.coins += r.coins;
  p.reputation += r.reputation;
  if (r.itemId) addItem(p, r.itemId);
  let unlocked: OpponentDef | null = null;
  if (won && !p.defeatedOpponents.includes(opp.id)) {
    p.defeatedOpponents.push(opp.id);
    const next = OPPONENTS[opponentIndex(opp.id) + 1];
    if (next) {
      unlocked = next;
      p.selectedOpponent = next.id;
    }
  }
  p.stats.battles++;
  if (won) p.stats.wins++;
  else p.stats.losses++;
  const rec: BattleRecord = {
    id: `b${p.stats.battles}-${input.now ?? Date.now()}`,
    date: input.now ?? Date.now(),
    opponentId: opp.id,
    opponentName: `${opp.name}, ${opp.epithet}`,
    opponentLevel: opp.level,
    playerLevel: playerLevelBefore,
    result: won ? 'win' : 'loss',
    reason: input.reason,
    duration: Math.round(input.duration),
    strategy: input.strategy,
    xp: r.xp,
    coins: r.coins,
    reputation: r.reputation,
    itemId: r.itemId,
    levelUps,
  };
  p.history.unshift(rec);
  if (p.history.length > HISTORY_LIMIT) p.history.length = HISTORY_LIMIT;
  return {
    result: won ? 'win' : 'loss',
    xp: r.xp,
    coins: r.coins,
    reputation: r.reputation,
    itemId: r.itemId,
    levelUps,
    newLevel: p.level,
    pointsGained: levelUps * POINTS_PER_LEVEL,
    unlockedOpponent: unlocked,
    firstVictory: r.firstVictory,
  };
}

export function reputationTitle(rep: number): string {
  if (rep >= 600) return 'Lenda de Roma';
  if (rep >= 350) return 'Campeão da Arena';
  if (rep >= 180) return 'Favorito do Público';
  if (rep >= 80) return 'Gladiador Conhecido';
  if (rep >= 25) return 'Promessa da Arena';
  return 'Tirocinius (novato)';
}
