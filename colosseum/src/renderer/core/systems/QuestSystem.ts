// Missões curtas dos moradores. Uma de cada vez; aparece no local de quem pede,
// dura alguns dias e paga em moedas, fama ou itens.
//  - Quintus (taverna): vencer um adversário da escada ou desafiantes do dia
//  - Taverneira (taverna): levar uma entrega a outro local da cidade
//  - Monge (templo): fazer uma oferenda (moedas) no altar de Marte
//  - Instrutor (ludus): treinar algumas vezes
//  - Ferreiro (mercado): vencer lutas com o equipamento que ele forjou
import type { LocationId, PlayerState, QuestState } from '../model/types';
import { daySeed } from '../data/fighters';
import { createRng } from './rng';
import { addItem } from './EquipmentSystem';
import { rollDrop } from './ProgressionSystem';
import { nextRival } from './NewsSystem';

export type QuestGiver = 'quintus' | 'keeper' | 'monk' | 'trainer' | 'smith';

/** onde cada morador fica (e onde a missão é oferecida e entregue) */
export const GIVER_PLACE: Record<QuestGiver, LocationId> = {
  quintus: 'tavern',
  keeper: 'tavern',
  monk: 'temple',
  trainer: 'ludus',
  smith: 'market',
};

export const QUEST_DAYS = 3;
/** dias de espera entre uma missão e outra */
export const QUEST_COOLDOWN = 1;
const DELIVERY_PLACES: LocationId[] = ['forum', 'baths', 'market', 'temple'];

export function questGiversAt(loc: LocationId): QuestGiver[] {
  return (Object.keys(GIVER_PLACE) as QuestGiver[]).filter((g) => GIVER_PLACE[g] === loc);
}

/** Missão que um morador oferece hoje (estável no dia), ou null. */
export function questOffer(p: PlayerState, loc: LocationId): QuestState | null {
  if (p.career.quest || p.day < 2) return null;
  if (p.career.questDay && p.day - p.career.questDay < QUEST_COOLDOWN) return null;
  const givers = questGiversAt(loc);
  if (!givers.length) return null;
  const rng = createRng(daySeed(p.createdAt, p.day, 140 + loc.length));
  // nem todo dia alguém tem um pedido
  if (rng() < 0.35) return null;
  const npc = givers[Math.floor(rng() * givers.length)];
  const lv = p.level;
  const base = { npc, progress: 0, day: p.day, expires: p.day + QUEST_DAYS };
  const coins = (n: number) => Math.round(n + lv * n * 0.15);
  switch (npc) {
    case 'quintus': {
      const rival = nextRival(p);
      const ladder = !p.defeatedOpponents.includes(rival.id) && rng() < 0.5;
      return ladder
        ? { ...base, id: `q-beat-${p.day}`, kind: 'beat', target: rival.id, need: 1, reward: { coins: coins(60), fame: 6, item: null } }
        : { ...base, id: `q-wins-${p.day}`, kind: 'wins', target: 'free', need: 2, reward: { coins: coins(45), fame: 4, item: null } };
    }
    case 'keeper': {
      const to = DELIVERY_PLACES[Math.floor(rng() * DELIVERY_PLACES.length)];
      return { ...base, id: `q-deliver-${p.day}`, kind: 'deliver', target: to, need: 1, reward: { coins: coins(30), fame: 2, item: null } };
    }
    case 'monk':
      return { ...base, id: `q-offer-${p.day}`, kind: 'offering', target: 'temple', need: 1, reward: { coins: 0, fame: 8, item: null } };
    case 'trainer':
      return { ...base, id: `q-train-${p.day}`, kind: 'train', target: 'any', need: 3, reward: { coins: coins(25), fame: 2, item: rng() < 0.4 ? 'item' : null } };
    case 'smith':
      return { ...base, id: `q-wins-${p.day}`, kind: 'wins', target: 'any', need: 2, reward: { coins: coins(40), fame: 3, item: 'item' } };
  }
  return null;
}

/** custo da oferenda do monge */
export function offeringCost(p: PlayerState): number {
  return 15 + p.level * 5;
}

export function acceptQuest(p: PlayerState, q: QuestState): void {
  p.career.quest = { ...q, reward: { ...q.reward } };
  p.career.questDay = p.day;
}

export function declineQuest(p: PlayerState): void {
  p.career.questDay = p.day;
}

export interface QuestDone {
  quest: QuestState;
  coins: number;
  fame: number;
  itemId: string | null;
}

function complete(p: PlayerState): QuestDone | null {
  const q = p.career.quest;
  if (!q || q.progress < q.need) return null;
  const rng = createRng(daySeed(p.createdAt, p.day, 150));
  // "item" = sorteio do ferreiro/instrutor conforme o nível
  const itemId = q.reward.item ? (q.reward.item === 'item' ? rollDrop(Math.min(8, Math.floor(p.level / 3) + 1), rng) : q.reward.item) : null;
  if (itemId) addItem(p, itemId);
  p.coins += q.reward.coins;
  p.reputation += q.reward.fame;
  p.career.quest = null;
  p.career.questsDone++;
  p.career.questDay = p.day;
  return { quest: q, coins: q.reward.coins, fame: q.reward.fame, itemId };
}

/** Uma luta terminou: avança missões de vitória. */
export function questOnFight(p: PlayerState, won: boolean, opponentId: string, mode: string): QuestDone | null {
  const q = p.career.quest;
  if (!q || !won) return null;
  if (q.kind === 'beat' && opponentId === q.target) q.progress = q.need;
  else if (q.kind === 'wins' && (q.target === 'any' || (q.target === 'free' && mode === 'free'))) q.progress++;
  else return null;
  return complete(p);
}

export function questOnTrain(p: PlayerState): QuestDone | null {
  const q = p.career.quest;
  if (!q || q.kind !== 'train') return null;
  q.progress++;
  return complete(p);
}

/** Chegou a um local: entrega da taverneira. */
export function questOnArrive(p: PlayerState, loc: LocationId): QuestDone | null {
  const q = p.career.quest;
  if (!q || q.kind !== 'deliver' || q.target !== loc) return null;
  q.progress = q.need;
  return complete(p);
}

/** Oferenda no templo (paga moedas). Retorna a chave do erro ou o resultado. */
export function makeOffering(p: PlayerState): QuestDone | 'noQuest' | 'noCoins' | 'notHere' {
  const q = p.career.quest;
  if (!q || q.kind !== 'offering') return 'noQuest';
  if (p.location !== 'temple') return 'notHere';
  const cost = offeringCost(p);
  if (p.coins < cost) return 'noCoins';
  p.coins -= cost;
  q.progress = q.need;
  return complete(p) ?? 'noQuest';
}

/** Missão vencida (chamado ao dormir). Retorna a missão perdida. */
export function expireQuest(p: PlayerState): QuestState | null {
  const q = p.career.quest;
  if (!q || p.day <= q.expires) return null;
  p.career.quest = null;
  p.career.questDay = p.day;
  return q;
}
