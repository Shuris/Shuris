// Amizade e lutas de dupla. Adversários da escada que você já derrotou passam a
// respeitá-lo (vitória limpa, revanche vencida, conversa onde eles costumam estar).
// Alguns odeiam o jogador e nunca viram amigos (RivalTownSystem). Com respeito
// suficiente viram amigos e aceitam formar dupla. A luta de dupla é simultânea: o
// jogador enfrenta um adversário na frente e o parceiro enfrenta o outro mais ao
// fundo da arena. Se uma dupla vence os dois duelos, vence a luta; se cada dupla
// vence um, os dois sobreviventes decidem num desempate com a vida que sobrou.
import type { PlayerState } from '../model/types';
import { getOpponent, type OpponentDef } from '../data/opponents';
import { POOL, daySeed, poolOpponent, shuffle } from '../data/fighters';
import { createRng } from './rng';
import { isHater } from './RivalTownSystem';

/** respeito necessário para virar amigo (0..100) */
export const FRIEND_RESPECT = 100;
export const RESPECT_FIRST_WIN = 40;
export const RESPECT_REMATCH_WIN = 20;
export const RESPECT_DUO = 10;
export const DUO_ENERGY = 35;

export function respectOf(p: PlayerState, id: string): number {
  return p.career.respect[id] ?? 0;
}

export function addRespect(p: PlayerState, id: string, n: number): boolean {
  // quem odeia o jogador nunca passa a respeitá-lo
  if (!p.defeatedOpponents.includes(id) || isHater(id)) return false;
  const before = respectOf(p, id);
  p.career.respect[id] = Math.min(100, before + n);
  return before < FRIEND_RESPECT && p.career.respect[id] >= FRIEND_RESPECT;
}

export function friends(p: PlayerState): OpponentDef[] {
  return Object.keys(p.career.respect)
    .filter((id) => respectOf(p, id) >= FRIEND_RESPECT && !isHater(id))
    .map((id) => getOpponent(id))
    .filter((o): o is OpponentDef => !!o);
}

export function setPartner(p: PlayerState, id: string): boolean {
  if (!friends(p).some((f) => f.id === id)) return false;
  p.career.partner = id;
  return true;
}

/** Parceiro com o nível acompanhando o jogador (os amigos também treinam). */
export function partnerDef(p: PlayerState): OpponentDef | null {
  const base = p.career.partner && !isHater(p.career.partner) ? getOpponent(p.career.partner) : null;
  if (!base) return null;
  return { ...base, level: Math.max(base.level, p.level - 1) };
}

export type DuoCheck = 'noPartner' | 'done' | null;

export function duoCheck(p: PlayerState): DuoCheck {
  if (!partnerDef(p)) return 'noPartner';
  if (p.career.duoDay === p.day) return 'done';
  return null;
}

/** A dupla adversária do dia (dois lutadores avulsos perto do nível do jogador). */
export function duoFoes(p: PlayerState): [OpponentDef, OpponentDef] {
  const rng = createRng(daySeed(p.createdAt, p.day, 130));
  const [a, b] = shuffle(rng, POOL).slice(0, 2);
  return [poolOpponent(a, p.level), poolOpponent(b, Math.max(1, p.level - 1 + (rng() < 0.5 ? 1 : 0)))];
}

/** Andamento de uma luta de dupla (fica na interface; não vai para o salvamento). */
export interface DuoRun {
  /** vida que sobrou de cada lutador: [jogador, parceiro] e [adversário 1, adversário 2] (0 = caiu) */
  ours: [number | null, number | null];
  theirs: [number | null, number | null];
  /** quem luta o desempate em cada lado (índice 0 ou 1) */
  a: number;
  b: number;
  /** assaltos já lutados (1 = os dois duelos simultâneos, 2 = desempate) */
  bouts: number;
  /** o jogador caiu (o parceiro decide a luta) */
  playerOut: boolean;
}

export function newDuoRun(): DuoRun {
  return { ours: [null, null], theirs: [null, null], a: 0, b: 0, bouts: 0, playerOut: false };
}

/** Resultado de um duelo: vencedor e vida restante de cada lado. */
export interface DuelEnd {
  winner: 0 | 1;
  hp: [number, number];
}

/**
 * Fim dos dois duelos simultâneos (jogador x adversário 1 na frente, parceiro x
 * adversário 2 ao fundo). Retorna 'win', 'loss' ou 'decider' (cada dupla venceu um).
 */
export function duoClash(run: DuoRun, front: DuelEnd, back: DuelEnd): 'win' | 'loss' | 'decider' {
  run.bouts = 1;
  run.ours = [front.winner === 0 ? front.hp[0] : 0, back.winner === 0 ? back.hp[0] : 0];
  run.theirs = [front.winner === 1 ? front.hp[1] : 0, back.winner === 1 ? back.hp[1] : 0];
  run.playerOut = run.ours[0] === 0;
  const ours = run.ours.filter((h) => (h ?? 0) > 0).length;
  if (ours === 2) return 'win';
  if (ours === 0) return 'loss';
  run.a = run.playerOut ? 1 : 0;
  run.b = (run.theirs[0] ?? 0) > 0 ? 0 : 1;
  return 'decider';
}

/** Fim do desempate. */
export function duoDecider(run: DuoRun, winner: 0 | 1): 'win' | 'loss' {
  run.bouts = 2;
  return winner === 0 ? 'win' : 'loss';
}

export interface DuoPrize {
  coins: number;
  fame: number;
  xp: number;
}

export function duoPrize(p: PlayerState, won: boolean): DuoPrize {
  return won ? { coins: 90 + p.level * 14, fame: 10 + Math.floor(p.level / 2), xp: 50 + p.level * 9 } : { coins: 15 + p.level * 2, fame: 0, xp: 15 + p.level * 3 };
}
