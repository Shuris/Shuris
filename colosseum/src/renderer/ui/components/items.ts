// Linhas de item e comparação de estatísticas (usadas no Mercado e na ficha do gladiador).
import type { ItemDef, PlayerState, Slot } from '../../core/model/types';
import { SLOTS } from '../../core/model/types';
import { RARITY_LABEL, getItem } from '../../core/data/equipment';
import { computeCombatStats, equippedItems, finalAttributes, naturalAttributes } from '../../core/systems/AttributeSystem';
import { esc, itemIcon, modsSummary, rarityName } from '../dom';

export const SLOT_LABEL: Record<Slot, string> = {
  mainHand: 'Arma',
  offHand: 'Escudo',
  head: 'Capacete',
  body: 'Armadura',
  legs: 'Pernas',
};

/** Ganho/perda nas estatísticas principais se o item for equipado. */
export function itemDelta(p: PlayerState, item: ItemDef): string {
  const gear = equippedItems(p);
  const nat = naturalAttributes(p);
  const a = computeCombatStats(finalAttributes(nat, gear), gear);
  const g2 = { ...gear, [item.slot]: item };
  const b = computeCombatStats(finalAttributes(nat, g2), g2);
  const out: string[] = [];
  const add = (label: string, x: number, y: number, fmt: (v: number) => string, higher = true) => {
    const diff = y - x;
    if (Math.abs(diff) < 0.5) return;
    const good = higher ? diff > 0 : diff < 0;
    out.push(`<em class="${good ? 'up' : 'down'}">${label} ${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))}</em>`);
  };
  add('Dano', a.baseDamage, b.baseDamage, (v) => v.toFixed(0));
  add('Defesa', a.damageReduction * 100, b.damageReduction * 100, (v) => `${v.toFixed(0)}%`);
  add('Vida', a.maxHp, b.maxHp, (v) => v.toFixed(0));
  add('Bloqueio', a.blockPower * 100, b.blockPower * 100, (v) => `${v.toFixed(0)}%`);
  add('Alcance', a.reach, b.reach, (v) => v.toFixed(0));
  if (b.attackInterval < a.attackInterval - 0.04) out.push('<em class="up">mais rápido</em>');
  if (b.attackInterval > a.attackInterval + 0.04) out.push('<em class="down">mais lento</em>');
  return out.length ? out.join(' ') : '<em class="dim">igual</em>';
}

export function itemRow(p: PlayerState, item: ItemDef, actions: string): string {
  return `<div class="item-row" title="${esc(`${item.description} (${RARITY_LABEL[item.rarity]}) — ${modsSummary(item.mods)}`)}">
    ${itemIcon(item)}
    <div class="item-info">
      <div>${rarityName(item)}${item.minLevel > p.level ? ` <span class="tag red">Nv ${item.minLevel}</span>` : ''}</div>
      <div class="item-delta">${itemDelta(p, item)}</div>
    </div>
    <div class="item-actions">${actions}</div>
  </div>`;
}

export function equippedSlots(p: PlayerState, withButtons: boolean): string {
  return SLOTS.map((slot) => {
    const uid = p.equipment[slot];
    const inv = uid ? p.inventory.find((i) => i.uid === uid) : undefined;
    const item = inv ? getItem(inv.itemId) : undefined;
    return `<div class="slot-row"><span class="slot-label">${SLOT_LABEL[slot]}</span>
      ${item ? `${itemIcon(item, 'sm')} ${rarityName(item)}${withButtons ? ` <button class="btn sm" data-action="unequip" data-id="${slot}">Tirar</button>` : ''}` : '<span class="dim">vazio</span>'}</div>`;
  }).join('');
}
