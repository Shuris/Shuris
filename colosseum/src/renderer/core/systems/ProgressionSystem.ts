import { BEAST_FAME_MUL } from './VenatioSystem';
import type { BattleRecord, FightMode, PlayerState, Rarity, StrategyId } from '../model/types';
import { MAX_LEVEL, POINTS_PER_LEVEL } from '../data/gladiators';
import { ITEMS } from '../data/equipment';
import { OPPONENTS, opponentIndex, type OpponentDef } from '../data/opponents';
import { addItem } from './EquipmentSystem';
import { pick, type Rng } from './rng';
import { onBattle, onRematchAsked } from './NewsSystem';
import { applyInjury, maybeAskRematch, recordRival, REMATCH_REWARD_MUL } from './RivalSystem';
import { FESTIVAL_FAME_MUL, isFestival } from './EventSystem';
import { opponentFullName } from '../../i18n/data';
import { t } from '../../i18n';

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
  /** dias de ferimento causados pela derrota (0 = nenhum) */
  injuryDays: number;
  /** o adversário pediu revanche */
  rematchAsked: boolean;
  festival: boolean;
  mode: FightMode;
}

/** Fama perdida numa derrota comum (bem menos que os 50 de faltar ao torneio). */
export function lossFame(oppLevel: number): number {
  return Math.min(10, 2 + Math.floor(oppLevel / 4));
}

export function computeRewards(p: PlayerState, opp: OpponentDef, won: boolean, rng: Rng, mode: FightMode = 'ladder') {
  const f = levelDiffFactor(p.level, opp.level);
  const firstVictory = mode === 'ladder' && won && !p.defeatedOpponents.includes(opp.id);
  // festival: a plateia lotada dobra a fama da luta
  const fameMul = isFestival(p.day) ? FESTIVAL_FAME_MUL : 1;
  if (!won) {
    // derrota custa um pouco de fama (no torneio, não: lá o castigo é faltar)
    const reputation = mode === 'tournament' ? 0 : -lossFame(opp.level);
    return { xp: Math.max(5, Math.round((30 + 12 * opp.level) * f * 0.2)), coins: 5 + opp.level, reputation, itemId: null, firstVictory };
  }
  const mul = mode === 'rematch' ? REMATCH_REWARD_MUL : mode === 'free' ? 0.9 : mode === 'beast' ? 1.2 : 1;
  const xp = Math.round((30 + 12 * opp.level) * f * mul);
  const coins = Math.round((20 + 8 * opp.level) * f * mul) + (firstVictory ? 25 + opp.level * 10 : 0);
  const fame = Math.max(1, Math.round((2 + opp.level) * Math.min(1, f))) + (firstVictory ? 5 : 0) + (mode === 'rematch' ? 4 : 0);
  // venatio: vencer uma fera vale bem mais fama
  const reputation = Math.round(fame * fameMul * (mode === 'beast' ? BEAST_FAME_MUL : 1)) + (mode === 'beast' ? 5 : 0);
  const dropChance = firstVictory ? 1 : mode === 'rematch' ? 0.5 : mode === 'free' ? 0.15 : mode === 'beast' ? 0.3 : 0.2;
  const idx = mode === 'free' || mode === 'beast' ? Math.min(OPPONENTS.length - 1, Math.floor(opp.level / 3)) : opponentIndex(opp.id);
  const itemId = rng() < dropChance ? rollDrop(Math.max(0, idx), rng) : null;
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
    p.skillPoints += 1;
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
  /** tipo de luta (padrão: escada de adversários) */
  mode?: FightMode;
}

/** Aplica o resultado de uma batalha ao jogador (vitória ou derrota — sem perdas). */
export function applyBattleResult(p: PlayerState, input: BattleOutcomeInput): BattleRewards {
  const { opponent: opp, won, rng } = input;
  const mode = input.mode ?? 'ladder';
  const playerLevelBefore = p.level;
  const festival = isFestival(p.day);
  const r = computeRewards(p, opp, won, rng, mode);
  const levelUps = grantXp(p, r.xp);
  p.coins += r.coins;
  p.reputation = Math.max(0, p.reputation + r.reputation);
  if (r.itemId) addItem(p, r.itemId);
  let unlocked: OpponentDef | null = null;
  if (mode === 'ladder' && won && !p.defeatedOpponents.includes(opp.id)) {
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
  const prevStreak = p.streak;
  p.streak = won ? Math.max(0, p.streak) + 1 : Math.min(0, p.streak) - 1;
  // rivais: lembram do resultado; quem perdeu pode pedir revanche (raramente)
  let rematchAsked = false;
  if (mode === 'ladder' || mode === 'rematch') {
    recordRival(p, opp.id, won);
    if (mode === 'rematch') p.rematch = null;
    if (won) rematchAsked = maybeAskRematch(p, opp.id, rng);
  }
  const injuryDays = won ? 0 : applyInjury(p, input.reason, rng);
  // a venatio tem as próprias manchetes (a fera não é um gladiador conhecido)
  if (mode !== 'beast') onBattle(p, opp, won, r.firstVictory, rng, input.reason, prevStreak, mode);
  if (rematchAsked) onRematchAsked(p, opp.id, rng);
  const rec: BattleRecord = {
    id: `b${p.stats.battles}-${input.now ?? Date.now()}`,
    date: input.now ?? Date.now(),
    opponentId: opp.id,
    opponentName: opponentFullName(opp),
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
    injuryDays,
    rematchAsked,
    festival,
    mode,
  };
}

export function reputationTitle(rep: number): string {
  if (rep >= 600) return t('rank.6');
  if (rep >= 350) return t('rank.5');
  if (rep >= 180) return t('rank.4');
  if (rep >= 80) return t('rank.3');
  if (rep >= 25) return t('rank.2');
  return t('rank.1');
}

/** Luta de torneio: entra no histórico e nas estatísticas, sem prêmio imediato (o prêmio vem no fim). */
export function recordFightOnly(
  p: PlayerState,
  opp: OpponentDef,
  won: boolean,
  reason: 'ko' | 'decision' | 'forfeit',
  duration: number,
  strategy: StrategyId,
  rng: Rng,
  now = Date.now(),
): number {
  p.stats.battles++;
  if (won) p.stats.wins++;
  else p.stats.losses++;
  p.streak = won ? Math.max(0, p.streak) + 1 : Math.min(0, p.streak) - 1;
  const injury = won ? 0 : applyInjury(p, reason, rng);
  p.history.unshift({
    id: `b${p.stats.battles}-${now}`,
    date: now,
    opponentId: opp.id,
    opponentName: opponentFullName(opp),
    opponentLevel: opp.level,
    playerLevel: p.level,
    result: won ? 'win' : 'loss',
    reason,
    duration: Math.round(duration),
    strategy,
    xp: 0,
    coins: 0,
    reputation: 0,
    itemId: null,
    levelUps: 0,
  });
  if (p.history.length > HISTORY_LIMIT) p.history.length = HISTORY_LIMIT;
  return injury;
}
