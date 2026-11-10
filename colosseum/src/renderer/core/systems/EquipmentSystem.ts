import type { InventoryItem, PlayerState, Slot } from '../model/types';
import { getItem, sellPrice } from '../data/equipment';
import { t } from '../../i18n';
import { itemName } from '../../i18n/data';

export type Result = { ok: true; message: string } | { ok: false; message: string };

const ok = (message: string): Result => ({ ok: true, message });
const fail = (message: string): Result => ({ ok: false, message });

export function addItem(p: PlayerState, itemId: string): InventoryItem {
  const inv = { uid: `i${p.nextUid++}`, itemId };
  p.inventory.push(inv);
  return inv;
}

export function isEquipped(p: PlayerState, uid: string): boolean {
  return Object.values(p.equipment).includes(uid);
}

export function canBuy(p: PlayerState, itemId: string): string | null {
  const item = getItem(itemId);
  if (!item) return t('err.noItem');
  if (!item.shop) return t('err.notForSale');
  if (p.level < item.minLevel) return t('err.needLevel', { n: item.minLevel });
  if (p.coins < item.price) return t('err.noCoins');
  if (p.inventory.length >= 40) return t('err.invFull');
  return null;
}

export function buyItem(p: PlayerState, itemId: string): Result {
  const err = canBuy(p, itemId);
  if (err) return fail(err);
  const item = getItem(itemId)!;
  p.coins -= item.price;
  addItem(p, itemId);
  return ok(t('market.bought', { name: itemName(item), n: item.price }));
}

export function equipItem(p: PlayerState, uid: string): Result {
  const inv = p.inventory.find((i) => i.uid === uid);
  const item = inv ? getItem(inv.itemId) : undefined;
  if (!inv || !item) return fail(t('err.itemNotFound'));
  if (p.level < item.minLevel) return fail(t('err.needLevel', { n: item.minLevel }));
  p.equipment[item.slot] = uid;
  return ok(t('char.equipped', { name: itemName(item) }));
}

export function unequipSlot(p: PlayerState, slot: Slot): Result {
  if (!p.equipment[slot]) return fail(t('err.slotEmpty'));
  p.equipment[slot] = null;
  return ok(t('char.unequipped'));
}

export function sellItem(p: PlayerState, uid: string): Result {
  const idx = p.inventory.findIndex((i) => i.uid === uid);
  if (idx < 0) return fail(t('err.itemNotFound'));
  if (isEquipped(p, uid)) return fail(t('err.unequipFirst'));
  const item = getItem(p.inventory[idx].itemId);
  if (!item) return fail(t('err.itemInvalid'));
  const price = sellPrice(item, p.inventory[idx].plus ?? 0);
  p.inventory.splice(idx, 1);
  p.coins += price;
  return ok(t('market.sold', { name: itemName(item), n: price }));
}
