import type { InventoryItem, PlayerState, Slot } from '../model/types';
import { getItem, sellPrice } from '../data/equipment';

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
  if (!item) return 'Item inexistente.';
  if (!item.shop) return 'Este item não está à venda.';
  if (p.level < item.minLevel) return `Requer nível ${item.minLevel}.`;
  if (p.coins < item.price) return 'Moedas insuficientes.';
  if (p.inventory.length >= 40) return 'Inventário cheio (40 itens).';
  return null;
}

export function buyItem(p: PlayerState, itemId: string): Result {
  const err = canBuy(p, itemId);
  if (err) return fail(err);
  const item = getItem(itemId)!;
  p.coins -= item.price;
  addItem(p, itemId);
  return ok(`${item.name} comprado por ${item.price} moedas.`);
}

export function equipItem(p: PlayerState, uid: string): Result {
  const inv = p.inventory.find((i) => i.uid === uid);
  const item = inv ? getItem(inv.itemId) : undefined;
  if (!inv || !item) return fail('Item não encontrado.');
  if (p.level < item.minLevel) return fail(`Requer nível ${item.minLevel}.`);
  p.equipment[item.slot] = uid;
  return ok(`${item.name} equipado.`);
}

export function unequipSlot(p: PlayerState, slot: Slot): Result {
  if (!p.equipment[slot]) return fail('Nada equipado neste espaço.');
  p.equipment[slot] = null;
  return ok('Item desequipado.');
}

export function sellItem(p: PlayerState, uid: string): Result {
  const idx = p.inventory.findIndex((i) => i.uid === uid);
  if (idx < 0) return fail('Item não encontrado.');
  if (isEquipped(p, uid)) return fail('Desequipe o item antes de vendê-lo.');
  const item = getItem(p.inventory[idx].itemId);
  if (!item) return fail('Item inválido.');
  const price = sellPrice(item);
  p.inventory.splice(idx, 1);
  p.coins += price;
  return ok(`${item.name} vendido por ${price} moedas.`);
}
