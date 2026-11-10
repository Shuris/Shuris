// Mercado: comprar e vender equipamentos.
import type { PlayerState } from '../../core/model/types';
import { ITEMS, getItem, sellPrice } from '../../core/data/equipment';
import { buyItem, canBuy, isEquipped, sellItem } from '../../core/systems/EquipmentSystem';
import { icon } from '../dom';
import { confirmModal, toast } from '../components/feedback';
import { itemRow } from '../components/items';
import { sound } from '../../audio/SoundManager';
import type { Screen, ScreenDeps } from './Screen';

export class MarketScreen implements Screen {
  readonly id = 'market' as const;
  readonly title = 'Mercado';
  readonly tip = 'Compre equipamentos aqui. Para equipar, abra a ficha do Gladiador.';
  private tab: 'buy' | 'sell' = 'buy';

  constructor(private readonly d: ScreenDeps) {}

  render(p: PlayerState): string {
    const tabs = `<div class="subtabs"><button class="btn ${this.tab === 'buy' ? 'active' : ''}" data-action="tab" data-id="buy">Comprar</button><button class="btn ${this.tab === 'sell' ? 'active' : ''}" data-action="tab" data-id="sell">Vender</button></div>`;
    const coins = `<p class="hint">${icon('coin', 'xs')} <b>${p.coins}</b> moedas</p>`;
    if (this.tab === 'buy') {
      const items = ITEMS.filter((i) => i.shop)
        .sort((a, b) => a.minLevel - b.minLevel || a.price - b.price)
        .map((item) => {
          const err = canBuy(p, item.id);
          return itemRow(p, item, `<button class="btn btn-gold sm" data-action="buy" data-id="${item.id}" ${err ? `disabled title="${err}"` : ''}>${icon('coin', 'xs')} ${item.price}</button>`);
        })
        .join('');
      return tabs + coins + `<div class="items">${items}</div>`;
    }
    const items = p.inventory
      .filter((i) => !isEquipped(p, i.uid))
      .map((inv) => {
        const item = getItem(inv.itemId);
        return item ? itemRow(p, item, `<button class="btn sm" data-action="sell" data-id="${inv.uid}">Vender ${sellPrice(item)}</button>`) : '';
      })
      .join('');
    return tabs + coins + `<div class="items">${items || '<p class="dim">Nada para vender (itens equipados não podem ser vendidos).</p>'}</div>`;
  }

  onAction(action: string, el: HTMLElement, p: PlayerState): void {
    const id = el.dataset.id ?? '';
    if (action === 'tab') {
      this.tab = id === 'sell' ? 'sell' : 'buy';
      this.d.actions.rerender();
    } else if (action === 'buy') {
      const r = this.d.store.update((pl) => buyItem(pl, id));
      toast(r.message, r.ok ? 'good' : 'bad');
      sound.play(r.ok ? 'coin' : 'error');
    } else if (action === 'sell') {
      const inv = p.inventory.find((i) => i.uid === id);
      const item = inv ? getItem(inv.itemId) : undefined;
      if (!item) return;
      void confirmModal('Vender?', `${item.name} por ${sellPrice(item)} moedas.`, 'Vender').then((ok) => {
        if (!ok) return;
        const r = this.d.store.update((pl) => sellItem(pl, id));
        toast(r.message, r.ok ? 'good' : 'bad');
        sound.play(r.ok ? 'coin' : 'error');
      });
    }
  }
}
