// Amizade e lutas de dupla. Adversários da escada que você já derrotou passam a
// respeitá-lo (vitória limpa, revanche vencida, conversa na taverna). Com respeito
// suficiente viram amigos e aceitam formar dupla. A luta de dupla é em revezamento:
// cada dupla entra com um lutador; quem cai é substituído pelo parceiro e o vencedor
// continua com a vida que sobrou. Perde a dupla que ficar sem lutadores.
import type { PlayerState } from '../model/types';
import { getOpponent, type OpponentDef } from '../data/opponents';
import { POOL, daySeed, poolOpponent, shuffle } from '../data/fighters';
import { createRng } from './rng';

/** respeito necessário para virar amigo (0..100) */
export const FRIEND_RESPECT = 60;
export const RESPECT_FIRST_WIN = 40;
export const RESPECT_REMATCH_WIN = 20;
export const RESPECT_TAVERN = 20;
export const RESPECT_DUO = 10;
export const DUO_ENERGY = 35;

export function respectOf(p: PlayerState, id: string): number {
  return p.career.respect[id] ?? 0;
}

export function addRespect(p: PlayerState, id: string, n: number): boolean {
  if (!p.defeatedOpponents.includes(id)) return false;
  const before = respectOf(p, id);
  p.career.respect[id] = Math.min(100, before + n);
  return before < FRIEND_RESPECT && p.career.respect[id] >= FRIEND_RESPECT;
}

export function friends(p: PlayerState): OpponentDef[] {
  return Object.keys(p.career.respect)
    .filter((id) => respectOf(p, id) >= FRIEND_RESPECT)
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
  const base = p.career.partner ? getOpponent(p.career.partner) : null;
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
  /** lado do jogador: 0 = o jogador, 1 = o parceiro */
  ours: [number | null, number | null];
  theirs: [number | null, number | null];
  /** quem está lutando agora em cada lado (índice 0 ou 1) */
  a: number;
  b: number;
  bouts: number;
  /** o jogador caiu (o parceiro terminou a luta) */
  playerOut: boolean;
}

export function newDuoRun(): DuoRun {
  return { ours: [null, null], theirs: [null, null], a: 0, b: 0, bouts: 0, playerOut: false };
}

/**
 * Registra o fim de um assalto. `hp` = vida restante de cada lado. Retorna
 * 'next' (outro assalto), 'win' ou 'loss'.
 */
export function duoBout(run: DuoRun, winner: 0 | 1, hp: [number, number]): 'next' | 'win' | 'loss' {
  run.bouts++;
  run.ours[run.a] = winner === 0 ? hp[0] : 0;
  run.theirs[run.b] = winner === 1 ? hp[1] : 0;
  if (winner === 1) {
    if (run.a === 0) run.playerOut = true;
    run.a++;
  } else run.b++;
  if (run.b > 1) return 'win';
  if (run.a > 1) return 'loss';
  return 'next';
}

export interface DuoPrize {
  coins: number;
  fame: number;
  xp: number;
}

export function duoPrize(p: PlayerState, won: boolean): DuoPrize {
  return won ? { coins: 90 + p.level * 14, fame: 10 + Math.floor(p.level / 2), xp: 50 + p.level * 9 } : { coins: 15 + p.level * 2, fame: 0, xp: 15 + p.level * 3 };
}
