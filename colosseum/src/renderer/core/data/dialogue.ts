// Personalidade dos personagens: falas de cada adversário e dos moradores.
// Os textos ficam no dicionário de idiomas (talk.<quem>.<situação>), com
// variantes separadas por "|". Aqui só ficam as regras de escolha.
import { tk, variant, type Params } from '../../i18n';

export type TalkMoment = 'intro' | 'reply' | 'win' | 'lose' | 'hurt' | 'crit';

/** Traço de personalidade (aparece na ficha do adversário e no tom das falas). */
export const PERSONALITY: Record<string, string> = {
  marcus: 'nervous',
  cassius: 'reckless',
  rufus: 'joker',
  brutus: 'brute',
  spiculus: 'disciplined',
  crixus: 'proud',
  verus: 'cold',
  priscus: 'weary',
  flamma: 'showman',
};

/** Fala de um adversário (ou do jogador, com who = 'player'). */
export function talk(who: string, moment: TalkMoment, pick: number, params: Params = {}): string {
  const raw = tk(`talk.${who}.${moment}`, params, '');
  return raw ? variant(raw, pick) : '';
}

/** Fala ambiente de um morador/NPC (monge, taverneira, doctore, vendedores...). */
export function npcLine(who: string, pick: number, params: Params = {}): string {
  const raw = tk(`npc.${who}`, params, '');
  return raw ? variant(raw, pick) : '';
}
