// Tela de equipamentos: itens equipados, inventário e mercado — compacta e legível.
import type { ItemDef, PlayerState, Slot } from '../../core/model/types';
import { SLOTS } from '../../core/model/types';
import { ITEMS, RARITY_LABEL, getItem, sellPrice } from '../../core/data/equipment';
import { buyItem, canBuy, equipItem, isEquipped, sellItem, unequipSlot } from '../../core/systems/EquipmentSystem';
import { computeCombatStats, equippedItems, finalAttributes, naturalAttributes } from '../../core/systems/AttributeSystem';
import { esc, icon, itemIcon, modsSummary, rarityName } from '../dom';
import { confirmModal, toast } from '../components/feedback';
import { sound } from '../../audio/SoundManager';
import type { Screen, ScreenDeps } from './Screen';

const SLOT_LABEL: Record<Slot, string> = {
  mainHand: 'Arma',
  offHand: 'Escudo',
  head: 'Capacete',
  body: 'Armadura',
  legs: 'Pernas',
};

export class InventoryScreen implements Screen {
  readonly id = 'equipment' as const;
  readonly title = 'Equipamentos';
  readonly tip = 'Compre no Mercado e equipe para ficar mais forte.';
  private tab: 'inventory' | 'market' = 'inventory';

  constructor(private readonly d: ScreenDeps) {}

  /** Ganho/perda nas estatísticas principais se o item for equipado. */
  private delta(p: PlayerState, item: ItemDef): string {
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

  private itemRow(p: PlayerState, item: ItemDef, actions: string): string {
    return `<div class="item-row" title="${esc(`${item.description} (${RARITY_LABEL[item.rarity]}) — ${modsSummary(item.mods)}`)}">
      ${itemIcon(item)}
      <div class="item-info">
        <div>${rarityName(item)}${item.minLevel > p.level ? ` <span class="tag red">Nv ${item.minLevel}</span>` : ''}</div>
        <div class="item-delta">${this.delta(p, item)}</div>
      </div>
      <div class="item-actions">${actions}</div>
    </div>`;
  }

  render(p: PlayerState): string {
    const tabs = `<div class="subtabs"><button class="btn ${this.tab === 'inventory' ? 'active' : ''}" data-action="tab" data-id="inventory">Meus itens</button><button class="btn ${this.tab === 'market' ? 'active' : ''}" data-action="tab" data-id="market">Mercado</button></div>`;
    return tabs + (this.tab === 'inventory' ? this.renderInventory(p) : this.renderMarket(p));
  }

  private renderInventory(p: PlayerState): string {
    const slots = SLOTS.map((slot) => {
      const uid = p.equipment[slot];
      const inv = uid ? p.inventory.find((i) => i.uid === uid) : undefined;
      const item = inv ? getItem(inv.itemId) : undefined;
      return `<div class="slot-row"><span class="slot-label">${SLOT_LABEL[slot]}</span>
        ${item ? `${itemIcon(item, 'sm')} ${rarityName(item)} <button class="btn sm" data-action="unequip" data-id="${slot}">Tirar</button>` : '<span class="dim">vazio</span>'}</div>`;
    }).join('');
    const free = p.inventory.filter((i) => !isEquipped(p, i.uid));
    const items = free
      .map((inv) => {
        const item = getItem(inv.itemId);
        if (!item) return '';
        const locked = p.level < item.minLevel;
        return this.itemRow(
          p,
          item,
          `<button class="btn btn-gold sm" data-action="equip" data-id="${inv.uid}" ${locked ? 'disabled' : ''}>Equipar</button>
           <button class="btn sm" data-action="sell" data-id="${inv.uid}">Vender ${sellPrice(item)}</button>`,
        );
      })
      .join('');
    return `<div class="slots card">${slots}</div>
      <h3>Guardados</h3>
      <div class="items">${items || '<p class="dim">Nada guardado. Veja o Mercado.</p>'}</div>`;
  }

  private renderMarket(p: PlayerState): string {
    const items = ITEMS.filter((i) => i.shop)
      .sort((a, b) => a.minLevel - b.minLevel || a.price - b.price)
      .map((item) => {
        const err = canBuy(p, item.id);
        return this.itemRow(p, item, `<button class="btn btn-gold sm" data-action="buy" data-id="${item.id}" ${err ? `disabled title="${esc(err)}"` : ''}>${icon('coin', 'xs')} ${item.price}</button>`);
      })
      .join('');
    return `<p class="hint">${icon('coin', 'xs')} <b>${p.coins}</b> moedas</p><div class="items">${items}</div>`;
  }

  onAction(action: string, el: HTMLElement, p: PlayerState): void {
    const id = el.dataset.id ?? '';
    const report = (r: { ok: boolean; message: string }, sfx: 'coin' | 'equip') => {
      toast(r.message, r.ok ? 'good' : 'bad');
      sound.play(r.ok ? sfx : 'error');
    };
    switch (action) {
      case 'tab':
        this.tab = id === 'market' ? 'market' : 'inventory';
        this.d.actions.rerender();
        break;
      case 'equip':
        report(this.d.store.update((pl) => equipItem(pl, id)), 'equip');
        this.d.actions.refreshVisual();
        break;
      case 'unequip':
        report(this.d.store.update((pl) => unequipSlot(pl, id as Slot)), 'equip');
        this.d.actions.refreshVisual();
        break;
      case 'buy':
        report(this.d.store.update((pl) => buyItem(pl, id)), 'coin');
        break;
      case 'sell': {
        const inv = p.inventory.find((i) => i.uid === id);
        const item = inv ? getItem(inv.itemId) : undefined;
        if (!item) return;
        void confirmModal('Vender?', `${item.name} por ${sellPrice(item)} moedas.`, 'Vender').then((ok) => {
          if (ok) report(this.d.store.update((pl) => sellItem(pl, id)), 'coin');
        });
        break;
      }
    }
  }
}
