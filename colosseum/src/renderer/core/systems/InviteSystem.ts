// Convites por fama: com 150 e 300 de fama chegam convites para amistosos em
// arenas particulares; com 400, para um torneio de elite (semifinal e final) na
// Arena de Ouro de Baiae. Cada convite vale uma vez. Amistoso não fere nem tira fama.
import type { InviteState, PlayerState } from '../model/types';
import type { OpponentDef } from '../data/opponents';
import { POOL, daySeed, getPoolFighter, poolOpponent, shuffle } from '../data/fighters';
import { opponentCombatant } from '../combat/CombatantFactory';
import { CombatEngine } from '../combat/CombatEngine';
import { addItem } from './EquipmentSystem';
import { grantXp, rollDrop, HISTORY_LIMIT } from './ProgressionSystem';
import { createRng, type Rng } from './rng';
import { opponentFullName } from '../../i18n/data';

export interface InviteDef {
  id: 'villa' | 'senator' | 'baiae';
  fame: number;
  kind: 'friendly' | 'tournament';
  /** anfitrião (nome nos textos) */
  host: string;
  /** níveis a mais que o jogador (um por adversário) */
  plus: number[];
}

export const INVITES: InviteDef[] = [
  { id: 'villa', fame: 150, kind: 'friendly', host: 'Lucullus', plus: [2] },
  { id: 'senator', fame: 300, kind: 'friendly', host: 'Varro', plus: [3] },
  { id: 'baiae', fame: 400, kind: 'tournament', host: 'Baiae', plus: [1, 2, 3] },
];

export const getInviteDef = (id: string) => INVITES.find((i) => i.id === id);

/** Chegam os convites cuja fama foi alcançada (uma vez só). Retorna os novos. */
export function checkInvites(p: PlayerState): InviteDef[] {
  const fresh: InviteDef[] = [];
  for (const def of INVITES) {
    if (p.reputation < def.fame || p.career.invites.some((i) => i.id === def.id)) continue;
    const rng = createRng(daySeed(p.createdAt, def.fame, 90));
    const foes = shuffle(rng, POOL)
      .slice(0, def.plus.length)
      .map((f, k) => ({ id: f.id, level: Math.max(1, Math.min(30, p.level + def.plus[k])) }));
    p.career.invites.push({ id: def.id, status: 'open', day: p.day, won: false, round: 0, foes });
    fresh.push(def);
  }
  return fresh;
}

export function openInvites(p: PlayerState): InviteState[] {
  return p.career.invites.filter((i) => i.status === 'open');
}

/** Adversário da luta atual do convite. */
export function inviteFoe(inv: InviteState): OpponentDef | null {
  const foe = inv.foes[inv.round];
  const f = foe ? getPoolFighter(foe.id) : undefined;
  return f && foe ? poolOpponent(f, foe.level) : null;
}

export interface InviteResult {
  won: boolean;
  coins: number;
  fame: number;
  xp: number;
  itemId: string | null;
  levelUps: number;
  /** o convite terminou (amistoso jogado, eliminado ou campeão) */
  done: boolean;
  /** torneio: próxima luta é a final */
  final: boolean;
  champion: boolean;
}

function prize(def: InviteDef, level: number, stage: 'win' | 'final' | 'champion' | 'out'): { coins: number; fame: number; xp: number } {
  if (def.id === 'villa') return stage === 'win' ? { coins: 180 + level * 12, fame: 22, xp: 60 + level * 10 } : { coins: 40, fame: 0, xp: 20 + level * 4 };
  if (def.id === 'senator') return stage === 'win' ? { coins: 380 + level * 18, fame: 38, xp: 90 + level * 12 } : { coins: 80, fame: 0, xp: 30 + level * 5 };
  // torneio de Baiae
  if (stage === 'champion') return { coins: 900 + level * 30, fame: 70, xp: 160 + level * 16 };
  if (stage === 'final') return { coins: 260 + level * 10, fame: 22, xp: 80 + level * 8 };
  return { coins: 60, fame: 5, xp: 40 + level * 5 };
}

/** Registra a luta no histórico (sem ferimento: amistosos e convites não ferem). */
export function recordSpecialFight(p: PlayerState, opp: OpponentDef, won: boolean, reason: 'ko' | 'decision' | 'forfeit', duration: number, r: { coins: number; fame: number; xp: number; itemId: string | null; levelUps: number }, now: number): void {
  p.stats.battles++;
  if (won) p.stats.wins++;
  else p.stats.losses++;
  p.streak = won ? Math.max(0, p.streak) + 1 : Math.min(0, p.streak) - 1;
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
    strategy: p.strategy,
    xp: r.xp,
    coins: r.coins,
    reputation: r.fame,
    itemId: r.itemId,
    levelUps: r.levelUps,
  });
  if (p.history.length > HISTORY_LIMIT) p.history.length = HISTORY_LIMIT;
}

/** Resultado de uma luta de convite: prêmios, avanço no torneio e fim do convite. */
export function finishInviteFight(
  p: PlayerState,
  id: string,
  won: boolean,
  reason: 'ko' | 'decision' | 'forfeit',
  duration: number,
  rng: Rng,
  now = Date.now(),
): InviteResult | null {
  const def = getInviteDef(id);
  const inv = p.career.invites.find((i) => i.id === id && i.status === 'open');
  const opp = inv ? inviteFoe(inv) : null;
  if (!def || !inv || !opp) return null;
  let stage: 'win' | 'final' | 'champion' | 'out';
  let final = false;
  if (def.kind === 'friendly') stage = won ? 'win' : 'out';
  else if (!won) stage = inv.round === 0 ? 'out' : 'final';
  else if (inv.round === 0) {
    // venceu a semifinal: a outra semifinal é simulada e o vencedor vai à final
    const a = inviteFoe({ ...inv, round: 1 });
    const b = inviteFoe({ ...inv, round: 2 });
    let finalist = 1;
    if (a && b) {
      const res = new CombatEngine(opponentCombatant(a).spec, opponentCombatant(b).spec, { seed: Math.floor(rng() * 1e9) }).runToEnd();
      finalist = res.winner === 0 ? 1 : 2;
    }
    if (finalist === 2) inv.foes = [inv.foes[0], inv.foes[2], inv.foes[1]];
    inv.round = 1;
    final = true;
    stage = 'win';
  } else stage = 'champion';

  // na semifinal vencida o prêmio só vem no fim do torneio (só um pouco de experiência)
  const pr = final ? { coins: 0, fame: 0, xp: 30 + p.level * 4 } : prize(def, p.level, stage);
  p.coins += pr.coins;
  p.reputation += pr.fame;
  const levelUps = grantXp(p, pr.xp);
  let itemId: string | null = null;
  if (stage === 'win' && !final) itemId = rollDrop(def.id === 'villa' ? 5 : 6, rng);
  if (stage === 'champion') itemId = rollDrop(7, rng);
  if (itemId) addItem(p, itemId);
  recordSpecialFight(p, opp, won, reason, duration, { ...pr, itemId, levelUps }, now);
  const done = !final;
  if (done) {
    inv.status = 'done';
    inv.won = won;
  }
  return { won, coins: pr.coins, fame: pr.fame, xp: pr.xp, itemId, levelUps, done, final, champion: stage === 'champion' };
}
