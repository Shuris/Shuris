// Mercado: comprar e vender equipamentos e comprar melhorias para o alojamento e o ludus.
import type { PlayerState } from '../../core/model/types';
import { ITEMS, getItem, sellPrice } from '../../core/data/equipment';
import { UPGRADES, canBuyUpgrade, buyUpgrade, getUpgrade, hasUpgrade, type UpgradeId } from '../../core/data/upgrades';
import { buyItem, canBuy, isEquipped, sellItem } from '../../core/systems/EquipmentSystem';
import { esc, icon } from '../dom';
import { confirmModal, toast } from '../components/feedback';
import { itemRow } from '../components/items';
import { canTrade } from '../../core/systems/CalendarSystem';
import { sound } from '../../audio/SoundManager';
import { t, tk } from '../../i18n';
import { itemName, locationName } from '../../i18n/data';
import type { Screen, ScreenDeps } from './Screen';

type Tab = 'buy' | 'sell' | 'upgrades';

export class MarketScreen implements Screen {
  readonly id = 'market' as const;
  get title() {
    return t('market.title');
  }
  get tip() {
    return t('market.tip');
  }
  private tab: Tab = 'buy';

  constructor(private readonly d: ScreenDeps) {}

  private upgradeErr(p: PlayerState, id: UpgradeId): string | null {
    const e = canBuyUpgrade(p, id);
    if (!e) return null;
    const u = getUpgrade(id);
    if (e === 'level') return t('market.needLevel', { n: u?.minLevel ?? 1 });
    if (e === 'requires') return t('market.needFirst', { name: tk(`upgrade.${u?.requires}.name`) });
    if (e === 'coins') return t('market.noCoins');
    return t('market.owned');
  }

  private upgrades(p: PlayerState, closed: string | null): string {
    const rows = UPGRADES.map((u) => {
      const owned = hasUpgrade(p, u.id);
      const err = closed ?? this.upgradeErr(p, u.id);
      const btn = owned
        ? `<span class="tag gold">${t('market.owned')}</span>`
        : `<button class="btn btn-gold sm" data-action="upgrade" data-id="${u.id}" ${err ? `disabled title="${esc(err)}"` : ''}>${icon('coin', 'xs')} ${u.price}</button>`;
      return `<div class="item-row upgrade ${owned ? 'owned' : ''}">
        <span class="item-icon">${icon(u.icon)}</span>
        <div class="item-info"><div><b>${esc(tk(`upgrade.${u.id}.name`))}</b> <span class="tag">${esc(locationName(u.place))}</span>${!owned && p.level < u.minLevel ? ` <span class="tag red">${t('common.lv', { n: u.minLevel })}</span>` : ''}</div>
          <div class="item-delta"><em class="up">${esc(tk(`upgrade.${u.id}.desc`))}</em></div></div>
        <div class="item-actions">${btn}</div></div>`;
    }).join('');
    return `<p class="hint">${t('market.upgradesHint')}</p><div class="items">${rows}</div>`;
  }

  render(p: PlayerState): string {
    const tb = (id: Tab, label: string) => `<button class="btn ${this.tab === id ? 'active' : ''}" data-action="tab" data-id="${id}">${label}</button>`;
    const tabs = `<div class="subtabs">${tb('buy', t('market.buy'))}${tb('sell', t('market.sell'))}${tb('upgrades', t('market.upgrades'))}</div>`;
    const closed = canTrade(p);
    const coins = `<p class="hint">${icon('coin', 'xs')} <b>${p.coins}</b> ${t('common.coinsLower')}</p>`;
    if (this.tab === 'upgrades') return tabs + coins + this.upgrades(p, closed);
    if (this.tab === 'buy') {
      const items = ITEMS.filter((i) => i.shop)
        .sort((a, b) => a.minLevel - b.minLevel || a.price - b.price)
        .map((item) => {
          const err = closed ?? canBuy(p, item.id);
          return itemRow(p, item, `<button class="btn btn-gold sm" data-action="buy" data-id="${item.id}" ${err ? `disabled title="${esc(err)}"` : ''}>${icon('coin', 'xs')} ${item.price}</button>`);
        })
        .join('');
      return tabs + coins + `<div class="items">${items}</div>`;
    }
    const items = p.inventory
      .filter((i) => !isEquipped(p, i.uid))
      .map((inv) => {
        const item = getItem(inv.itemId);
        return item ? itemRow(p, item, `<button class="btn sm" data-action="sell" data-id="${inv.uid}" ${closed ? `disabled title="${esc(closed)}"` : ''}>${t('market.sellFor', { n: sellPrice(item) })}</button>`) : '';
      })
      .join('');
    return tabs + coins + `<div class="items">${items || `<p class="dim">${t('market.nothingToSell')}</p>`}</div>`;
  }

  onAction(action: string, el: HTMLElement, p: PlayerState): void {
    const id = el.dataset.id ?? '';
    const closed = canTrade(p);
    if (closed && (action === 'buy' || action === 'sell' || action === 'upgrade')) {
      sound.play('error');
      toast(closed, 'bad');
      return;
    }
    if (action === 'tab') {
      this.tab = id === 'sell' ? 'sell' : id === 'upgrades' ? 'upgrades' : 'buy';
      this.d.actions.rerender();
    } else if (action === 'buy') {
      const r = this.d.store.update((pl) => buyItem(pl, id));
      toast(r.message, r.ok ? 'good' : 'bad');
      sound.play(r.ok ? 'coin' : 'error');
    } else if (action === 'upgrade') {
      const err = this.d.store.update((pl) => buyUpgrade(pl, id as UpgradeId));
      if (err) {
        sound.play('error');
        toast(this.upgradeErr(p, id as UpgradeId) ?? t('market.noCoins'), 'bad');
      } else {
        sound.play('coin');
        toast(t('market.upgradeBought', { name: tk(`upgrade.${id}.name`), place: locationName(getUpgrade(id)?.place ?? 'home') }), 'gold', 4500);
      }
    } else if (action === 'sell') {
      const inv = p.inventory.find((i) => i.uid === id);
      const item = inv ? getItem(inv.itemId) : undefined;
      if (!item) return;
      void confirmModal(t('market.sellTitle'), t('market.sellBody', { name: itemName(item), n: sellPrice(item) }), t('market.sell')).then((ok) => {
        if (!ok) return;
        const r = this.d.store.update((pl) => sellItem(pl, id));
        toast(r.message, r.ok ? 'good' : 'bad');
        sound.play(r.ok ? 'coin' : 'error');
      });
    }
  }
}
