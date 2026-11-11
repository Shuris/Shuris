// Rivais pela cidade: cada adversário da escada, depois de derrotado, passa a ser
// encontrado num lugar fixo (taverna, mercado, ludus, templo ou termas). Dá para
// conversar com ele uma vez por dia (respeito, que leva à amizade e às duplas). Nem
// todos aceitam: alguns rivais têm ódio genuíno do jogador e nunca viram amigos.
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

/** respeito ganho numa conversa */
export const RESPECT_CHAT = 20;

export function isHater(id: string): boolean {
  return HATERS.has(id);
}

/** Rivais derrotados que estão neste local. */
export function rivalsAt(p: PlayerState, loc: LocationId): OpponentDef[] {
  return p.defeatedOpponents
    .filter((id) => RIVAL_HOME[id] === loc)
    .map((id) => getOpponent(id))
    .filter((o): o is OpponentDef => !!o);
}

export type ChatResult = 'done' | 'hate' | { friend: boolean };

/**
 * Conversa com um rival (uma por dia, com qualquer rival). Quem odeia o jogador só
 * responde com desprezo; os outros ganham respeito.
 */
export function chatWithRival(p: PlayerState, id: string, addRespect: (p: PlayerState, id: string, n: number) => boolean): ChatResult {
  if (p.career.talkDay === p.day) return 'done';
  p.career.talkDay = p.day;
  if (isHater(id)) return 'hate';
  return { friend: addRespect(p, id, RESPECT_CHAT) };
}
