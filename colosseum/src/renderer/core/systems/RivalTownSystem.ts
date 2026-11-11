// Rivais pela cidade: cada adversário da escada, depois de derrotado, passa a ser
// encontrado num lugar fixo (taverna, mercado, ludus, templo ou termas). Clicar nele
// (uma vez por dia em cada um) faz ele falar e aumenta a amizade, que leva às duplas.
// Alguns rivais têm ódio genuíno do jogador: nunca aparecem nem viram amigos.
import type { LocationId, PlayerState } from '../model/types';
import { getOpponent, type OpponentDef } from '../data/opponents';

/** onde cada rival costuma estar depois de perder para você */
export const RIVAL_HOME: Record<string, LocationId> = {
  marcus: 'tavern',
  cassius: 'market',
  rufus: 'baths',
  brutus: 'ludus',
  spiculus: 'temple',
  crixus: 'tavern',
  verus: 'baths',
  priscus: 'market',
  flamma: 'temple',
};

/** rivais que odeiam o jogador: nunca aceitam amizade nem dupla */
export const HATERS: ReadonlySet<string> = new Set(['brutus', 'crixus', 'priscus']);

/** amizade ganha num clique (sorteada entre os dois valores) */
export const CHAT_MIN = 10;
export const CHAT_MAX = 15;

export function isHater(id: string): boolean {
  return HATERS.has(id);
}

/** Rivais derrotados que estão neste local e respeitam o jogador (quem odeia não aparece). */
export function rivalsAt(p: PlayerState, loc: LocationId): OpponentDef[] {
  return p.defeatedOpponents
    .filter((id) => RIVAL_HOME[id] === loc && !isHater(id))
    .map((id) => getOpponent(id))
    .filter((o): o is OpponentDef => !!o);
}

/** Já conversou hoje com este rival? */
export function chattedToday(p: PlayerState, id: string): boolean {
  return p.career.chatDays[id] === p.day;
}

export type ChatResult = 'done' | 'hate' | { friend: boolean; gain: number };

/**
 * Clique num rival pela cidade: uma vez por dia em cada um, +10 a 15 de amizade.
 * Quem odeia o jogador não conversa.
 */
export function chatWithRival(p: PlayerState, id: string, addRespect: (p: PlayerState, id: string, n: number) => boolean, rnd: () => number = Math.random): ChatResult {
  if (isHater(id)) return 'hate';
  if (chattedToday(p, id)) return 'done';
  p.career.chatDays[id] = p.day;
  const gain = CHAT_MIN + Math.floor(rnd() * (CHAT_MAX - CHAT_MIN + 1));
  return { friend: addRespect(p, id, gain), gain };
}
