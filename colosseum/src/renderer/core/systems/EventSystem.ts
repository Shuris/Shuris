// Eventos da cidade: o mercador viajante (a cada 6 a 10 dias), a queda de braço
// na taverna (domingo à noite) e o festival (a cada 14 dias, fama em dobro).
// Tudo é determinístico por gladiador e dia: recarregar não muda nada.
import type { ItemDef, PlayerState } from '../model/types';
import { ITEMS, getItem } from '../data/equipment';
import { getLocation, isOpen, isSunday } from '../data/locations';
import { daySeed } from '../data/fighters';
import { addItem } from './EquipmentSystem';
import { playerCombatStats } from './AttributeSystem';
import { advance, DAY_END, spendEnergy, type Check } from './CalendarSystem';
import { createRng, pick } from './rng';
import { t } from '../../i18n';

// ------------------------------------------------------------------ festival
export const FESTIVAL_EVERY = 14;
export const FESTIVAL_OFFSET = 10;
export const FESTIVAL_FAME_MUL = 2;

export function isFestival(day: number): boolean {
  return day % FESTIVAL_EVERY === FESTIVAL_OFFSET;
}

export function nextFestival(day: number): number {
  let d = day;
  while (!isFestival(d)) d++;
  return d;
}

// ------------------------------------------------------------------ mercador
export const MERCHANT_OPEN = 7 * 60;
export const MERCHANT_CLOSE = 20 * 60;

/** Dias de visita do mercador até `upTo` (intervalo de 6 a 10 dias; nunca no domingo). */
export function merchantDays(seed: number, upTo: number): number[] {
  const rng = createRng((seed ^ 0x6d657263) >>> 0);
  const out: number[] = [];
  let d = 4 + Math.floor(rng() * 3);
  while (d <= upTo) {
    const visit = isSunday(d) ? d + 1 : d;
    out.push(visit);
    d = visit + 6 + Math.floor(rng() * 5);
  }
  return out;
}

export function isMerchantDay(seed: number, day: number): boolean {
  return merchantDays(seed, day + 1).includes(day);
}

export function nextMerchantDay(seed: number, day: number): number {
  return merchantDays(seed, day + 12).find((d) => d >= day) ?? day + 10;
}

/** O mercador está na praça agora (dia de visita, mercado aberto). */
export function merchantHere(p: PlayerState): boolean {
  return isMerchantDay(p.createdAt, p.day) && isOpen(getLocation('market'), p.minutes, p.day);
}

export interface MerchantOffer {
  item: ItemDef;
  price: number;
  /** item raro que não se encontra nas bancas */
  exotic: boolean;
}

/** Mercadorias da visita: duas raridades que não estão à venda no mercado e uma com desconto. */
export function merchantStock(seed: number, day: number, level: number): MerchantOffer[] {
  const rng = createRng(daySeed(seed, day, 7));
  const exoticPool = ITEMS.filter((i) => !i.shop && i.id !== 'rudis' && i.minLevel <= level + 6);
  const shopPool = ITEMS.filter((i) => i.shop && i.minLevel <= level + 3 && i.rarity !== 'common');
  const offers: MerchantOffer[] = [];
  const used = new Set<string>();
  const take = (pool: ItemDef[], exotic: boolean) => {
    const free = pool.filter((i) => !used.has(i.id));
    if (!free.length) return;
    const item = pick(rng, free);
    used.add(item.id);
    offers.push({ item, exotic, price: exotic ? Math.round(item.price * 1.1) : Math.round(item.price * 0.75) });
  };
  take(exoticPool.length ? exoticPool : shopPool, true);
  take(exoticPool.length > 1 ? exoticPool : shopPool, true);
  take(shopPool, false);
  return offers;
}

export function canBuyFromMerchant(p: PlayerState, itemId: string): Check {
  if (!merchantHere(p)) return t('event.merchantGone');
  const offer = merchantStock(p.createdAt, p.day, p.level).find((o) => o.item.id === itemId);
  if (!offer) return t('err.noItem');
  if (p.events.merchantDay === p.day && p.events.merchantBought.includes(itemId)) return t('event.soldOut');
  if (p.level < offer.item.minLevel) return t('err.needLevel', { n: offer.item.minLevel });
  if (p.coins < offer.price) return t('err.noCoins');
  if (p.inventory.length >= 40) return t('err.invFull');
  return null;
}

export function buyFromMerchant(p: PlayerState, itemId: string): Check {
  const err = canBuyFromMerchant(p, itemId);
  if (err) return err;
  const offer = merchantStock(p.createdAt, p.day, p.level).find((o) => o.item.id === itemId)!;
  if (p.events.merchantDay !== p.day) p.events = { ...p.events, merchantDay: p.day, merchantBought: [] };
  p.events.merchantBought.push(itemId);
  p.coins -= offer.price;
  addItem(p, itemId);
  return null;
}

// ------------------------------------------------------------------ queda de braço
export const ARM_START = 19 * 60;
export const ARM_END = 23 * 60;
export const ARM_ENERGY = 10;
export const ARM_MINUTES = 30;

export function armFee(p: PlayerState): number {
  return 10 + p.level * 2;
}

export function armPrize(p: PlayerState): number {
  return 30 + p.level * 6;
}

export function isArmNight(day: number, minutes: number): boolean {
  return isSunday(day) && minutes >= ARM_START && minutes < ARM_END;
}

export function canArmWrestle(p: PlayerState): Check {
  if (!isSunday(p.day)) return t('event.armSundayOnly');
  if (p.minutes < ARM_START || p.minutes >= ARM_END) return t('event.armHours');
  if (p.events.armDay === p.day) return t('event.armDone');
  if (p.energy < ARM_ENERGY) return t('cal.tooTired');
  if (p.coins < armFee(p)) return t('err.noCoins');
  if (p.minutes + ARM_MINUTES > DAY_END) return t('cal.tooLate');
  return null;
}

/** Parâmetros do minijogo: zona de acerto (força ajuda) e força do adversário. */
export function armSetup(p: PlayerState): { zone: number; push: number; pull: number; champion: string } {
  const str = playerCombatStats(p).attrs.str;
  const zone = Math.min(0.42, 0.16 + str * 0.006);
  const push = 10 + Math.min(8, str * 0.18);
  const pull = 9 + p.events.armWins * 1.6 + Math.min(10, p.level * 0.35);
  const names = ['Pollux', 'Gorgo', 'Taurus', 'Magnus', 'Bubulcus'];
  return { zone, push, pull, champion: names[p.events.armWins % names.length] };
}

/** Resultado da queda de braço: paga a inscrição, cansa e (se vencer) leva o prêmio. */
export function finishArmWrestle(p: PlayerState, won: boolean): { coins: number; fame: number } {
  p.events.armDay = p.day;
  p.coins -= Math.min(p.coins, armFee(p));
  spendEnergy(p, ARM_ENERGY);
  advance(p, ARM_MINUTES);
  if (!won) return { coins: 0, fame: 0 };
  p.events.armWins++;
  const coins = armPrize(p);
  p.coins += coins;
  p.reputation += 3;
  return { coins, fame: 3 };
}

/** Item do mercador ainda à venda nesta visita? */
export function merchantSoldOut(p: PlayerState, itemId: string): boolean {
  return p.events.merchantDay === p.day && p.events.merchantBought.includes(itemId);
}

export { getItem };
