// Tela de equipamentos: itens equipados, inventário (equipar/desequipar/vender) e mercado.
import type { ItemDef, PlayerState, Slot } from '../../core/model/types';
import { SLOTS } from '../../core/model/types';
import { CATEGORY_LABEL, ITEMS, RARITY_LABEL, getItem, sellPrice } from '../../core/data/equipment';
import { buyItem, canBuy, equipItem, isEquipped, sellItem, unequipSlot } from '../../core/systems/EquipmentSystem';
import { computeCombatStats, equippedItems, finalAttributes, naturalAttributes } from '../../core/systems/AttributeSystem';
import { esc, icon, itemIcon, modsSummary, rarityName } from '../dom';
import { confirmModal, toast } from '../components/feedback';
import type { Screen, ScreenDeps } from './Screen';

const SLOT_LABEL: Record<Slot, string> = {
  mainHand: 'Arma principal',
  offHand: 'Escudo / secundária',
  head: 'Capacete',
  body: 'Armadura',
  legs: 'Pernas',
};

export class InventoryScreen implements Screen {
  readonly id = 'equipment' as const;
  readonly title = 'Equipamentos';
  readonly tip = 'Equipe itens para alterar a aparência e as estatísticas do gladiador. No Mercado você compra novos itens; vitórias também podem render equipamentos. A diferença em relação ao item atual aparece em verde/vermelho.';
  private tab: 'inventory' | 'market' = 'inventory';

  constructor(private readonly d: ScreenDeps) {}

  /** Diferença nas estatísticas principais caso o item seja equipado. */
  private delta(p: PlayerState, item: ItemDef): string {
    const gear = equippedItems(p);
    const nat = naturalAttributes(p);
    const a = computeCombatStats(finalAttributes(nat, gear), gear);
    const g2 = { ...gear, [item.slot]: item };
    const b = computeCombatStats(finalAttributes(nat, g2), g2);
    const out: string[] = [];
    const add = (label: string, x: number, y: number, fmt: (v: number) => string, higher = true) => {
      const diff = y - x;
      if (Math.abs(diff) < 0.005) return;
      const good = higher ? diff > 0 : diff < 0;
      out.push(`<em class="${good ? 'up' : 'down'}">${label} ${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))}</em>`);
    };
    add('Dano', a.baseDamage, b.baseDamage, (v) => v.toFixed(1));
    add('Redução', a.damageReduction * 100, b.damageReduction * 100, (v) => `${v.toFixed(1)}%`);
    add('Vida', a.maxHp, b.maxHp, (v) => v.toFixed(0));
    add('Intervalo', a.attackInterval, b.attackInterval, (v) => `${v.toFixed(2)}s`, false);
    add('Esquiva', a.dodgeChance * 100, b.dodgeChance * 100, (v) => `${v.toFixed(1)}%`);
    add('Bloqueio', a.blockPower * 100, b.blockPower * 100, (v) => `${v.toFixed(0)}%`);
    add('Alcance', a.reach, b.reach, (v) => v.toFixed(0));
    return out.join(' ');
  }

  private itemRow(p: PlayerState, item: ItemDef, actions: string, compare: boolean): string {
    return `<div class="item-row">
      ${itemIcon(item)}
      <div class="item-info">
        <div>${rarityName(item)} <span class="tag">${RARITY_LABEL[item.rarity]}</span> <span class="tag dim">${CATEGORY_LABEL[item.category]}</span>${item.minLevel > 1 ? ` <span class="tag ${p.level < item.minLevel ? 'red' : 'dim'}">Nv ${item.minLevel}</span>` : ''}</div>
        <div class="item-mods">${esc(modsSummary(item.mods))}</div>
        <div class="item-desc">${esc(item.description)}</div>
        ${compare ? `<div class="item-delta">${this.delta(p, item)}</div>` : ''}
      </div>
      <div class="item-actions">${actions}</div>
    </div>`;
  }

  render(p: PlayerState): string {
    const tabs = `<div class="subtabs"><button class="btn ${this.tab === 'inventory' ? 'active' : ''}" data-action="tab" data-id="inventory">Equipados e inventário</button><button class="btn ${this.tab === 'market' ? 'active' : ''}" data-action="tab" data-id="market">Mercado</button></div>`;
    return tabs + (this.tab === 'inventory' ? this.renderInventory(p) : this.renderMarket(p));
  }

  private renderInventory(p: PlayerState): string {
    const slots = SLOTS.map((slot) => {
      const uid = p.equipment[slot];
      const inv = uid ? p.inventory.find((i) => i.uid === uid) : undefined;
      const item = inv ? getItem(inv.itemId) : undefined;
      return `<div class="slot-row"><span class="slot-label">${SLOT_LABEL[slot]}</span>
        ${item ? `${itemIcon(item, 'sm')} ${rarityName(item)} <button class="btn sm" data-action="unequip" data-id="${slot}">Desequipar</button>` : '<span class="dim">— vazio —</span>'}</div>`;
    }).join('');
    const free = p.inventory.filter((i) => !isEquipped(p, i.uid));
    const items = free
      .map((inv) => {
        const item = getItem(inv.itemId);
        if (!item) return '';
        const lockedLvl = p.level < item.minLevel;
        const actions = `<button class="btn btn-gold sm" data-action="equip" data-id="${inv.uid}" ${lockedLvl ? 'disabled title="Nível insuficiente"' : ''}>Equipar</button>
          <button class="btn sm" data-action="sell" data-id="${inv.uid}">Vender ${icon('coin', 'xs')}${sellPrice(item)}</button>`;
        return this.itemRow(p, item, actions, true);
      })
      .join('');
    return `<h3>Equipados</h3><div class="slots card">${slots}</div>
      <h3>Inventário <span class="tag dim">${p.inventory.length}/40</span></h3>
      <div class="items">${items || '<p class="dim">Nenhum item guardado. Visite o Mercado ou vença lutas para obter equipamentos.</p>'}</div>`;
  }

  private renderMarket(p: PlayerState): string {
    const items = ITEMS.filter((i) => i.shop)
      .sort((a, b) => a.minLevel - b.minLevel || a.price - b.price)
      .map((item) => {
        const err = canBuy(p, item.id);
        const owned = p.inventory.filter((i) => i.itemId === item.id).length;
        const actions = `<button class="btn btn-gold sm" data-action="buy" data-id="${item.id}" ${err ? `disabled title="${esc(err)}"` : ''}>Comprar ${icon('coin', 'xs')}${item.price}</button>${owned ? `<span class="tag dim">possui ${owned}</span>` : ''}`;
        return this.itemRow(p, item, actions, true);
      })
      .join('');
    return `<p class="hint">Suas moedas: ${icon('coin', 'xs')} <b>${p.coins}</b>. Itens épicos não são vendidos: só podem ser conquistados na arena.</p><div class="items">${items}</div>`;
  }

  onAction(action: string, el: HTMLElement, p: PlayerState): void {
    const id = el.dataset.id ?? '';
    const report = (r: { ok: boolean; message: string }) => toast(r.message, r.ok ? 'good' : 'bad');
    switch (action) {
      case 'tab':
        this.tab = id === 'market' ? 'market' : 'inventory';
        this.d.actions.rerender();
        break;
      case 'equip':
        report(this.d.store.update((pl) => equipItem(pl, id)));
        this.d.actions.refreshVisual();
        break;
      case 'unequip':
        report(this.d.store.update((pl) => unequipSlot(pl, id as Slot)));
        this.d.actions.refreshVisual();
        break;
      case 'buy':
        report(this.d.store.update((pl) => buyItem(pl, id)));
        break;
      case 'sell': {
        const inv = p.inventory.find((i) => i.uid === id);
        const item = inv ? getItem(inv.itemId) : undefined;
        if (!item) return;
        void confirmModal('Vender item', `Vender ${item.name} por ${sellPrice(item)} moedas?`, 'Vender').then((ok) => {
          if (ok) report(this.d.store.update((pl) => sellItem(pl, id)));
        });
        break;
      }
    }
  }
}
