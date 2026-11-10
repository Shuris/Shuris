// Mercado: comprar e vender equipamentos e comprar melhorias para o alojamento e o ludus.
import type { PlayerState } from '../../core/model/types';
import { ITEMS, MAX_PLUS, forgeCost, forgeLevel, getItem, invItem, sellPrice } from '../../core/data/equipment';
import { buyFromMerchant, canBuyFromMerchant, merchantHere, merchantSoldOut, merchantStock, nextMerchantDay } from '../../core/systems/EventSystem';
import { canForge, forgeItem } from '../../core/systems/ForgeSystem';
import { itemIcon, rarityName } from '../dom';
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

type Tab = 'buy' | 'sell' | 'upgrades' | 'forge' | 'merchant';

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

  /** Ferreiro: melhora armas e armaduras (+1 a +3). */
  private forge(p: PlayerState, closed: string | null): string {
    const rows = p.inventory
      .map((inv) => {
        const base = getItem(inv.itemId);
        const item = invItem(inv);
        if (!base || !item || base.id === 'rudis') return '';
        const plus = inv.plus ?? 0;
        const err = closed ?? canForge(p, inv.uid);
        const btn =
          plus >= MAX_PLUS
            ? `<span class="tag gold">${t('forge.max')}</span>`
            : `<button class="btn btn-gold sm" data-action="forge" data-id="${inv.uid}" ${err ? `disabled title="${esc(err)}"` : ''}>${t('forge.improve', { n: plus + 1 })} ${icon('coin', 'xs')} ${forgeCost(base, plus)}</button>`;
        const need = plus < MAX_PLUS && p.level < forgeLevel(base, plus) ? ` <span class="tag red">${t('common.lv', { n: forgeLevel(base, plus) })}</span>` : '';
        return `<div class="item-row">${itemIcon(item)}<div class="item-info"><div>${rarityName(item)}${need}${isEquipped(p, inv.uid) ? ` <span class="tag">${t('forge.equipped')}</span>` : ''}</div>
          <div class="item-delta"><em class="dim">${esc(this.forgeHint(item))}</em></div></div><div class="item-actions">${btn}</div></div>`;
      })
      .join('');
    return `<div class="monk-say forge-say"><b>${t('forge.smithName')}:</b><span>“${esc(t('forge.greet'))}”</span></div><p class="hint">${t('forge.hint')}</p><div class="items">${rows}</div>`;
  }

  private forgeHint(item: { category: string; mods: { damage?: number; defense?: number } }): string {
    return item.category === 'weapon' ? t('forge.damage', { n: item.mods.damage ?? 0 }) : t('forge.defense', { n: item.mods.defense ?? 0 });
  }

  /** Mercador viajante: aparece a cada 6 a 10 dias com mercadorias raras. */
  private merchant(p: PlayerState): string {
    if (!merchantHere(p)) return `<p class="hint">${t('event.merchantNext', { day: nextMerchantDay(p.createdAt, p.day + 1) })}</p>`;
    const rows = merchantStock(p.createdAt, p.day, p.level)
      .map((o) => {
        const sold = merchantSoldOut(p, o.item.id);
        const err = canBuyFromMerchant(p, o.item.id);
        const btn = sold
          ? `<span class="tag">${t('event.soldOut')}</span>`
          : `<button class="btn btn-gold sm" data-action="merchant-buy" data-id="${o.item.id}" ${err ? `disabled title="${esc(err)}"` : ''}>${icon('coin', 'xs')} ${o.price}</button>`;
        return itemRow(p, o.item, `${o.exotic ? `<span class="tag gold">${t('event.exotic')}</span>` : `<span class="tag">${t('event.discount')}</span>`} ${btn}`);
      })
      .join('');
    return `<div class="monk-say merchant-say"><b>${t('event.merchantName')}:</b><span>“${esc(t('event.merchantGreet', { name: p.name }))}”</span></div><div class="items">${rows}</div>`;
  }

  render(p: PlayerState): string {
    const here = merchantHere(p);
    if (this.tab === 'merchant' && !here) this.tab = 'buy';
    const tb = (id: Tab, label: string) => `<button class="btn ${this.tab === id ? 'active' : ''} ${id === 'merchant' ? 'btn-merchant' : ''}" data-action="tab" data-id="${id}">${label}</button>`;
    const tabs = `<div class="subtabs">${tb('buy', t('market.buy'))}${tb('sell', t('market.sell'))}${tb('upgrades', t('market.upgrades'))}${tb('forge', t('market.forge'))}${here ? tb('merchant', t('market.merchant')) : ''}</div>`;
    const closed = canTrade(p);
    const coins = `<p class="hint">${icon('coin', 'xs')} <b>${p.coins}</b> ${t('common.coinsLower')}</p>`;
    const banner = here && this.tab !== 'merchant' ? `<button class="btn btn-merchant wide sm" data-action="tab" data-id="merchant">${t('event.merchantHere')}</button>` : '';
    if (this.tab === 'upgrades') return tabs + banner + coins + this.upgrades(p, closed);
    if (this.tab === 'forge') return tabs + banner + coins + this.forge(p, closed);
    if (this.tab === 'merchant') return tabs + coins + this.merchant(p);
    if (this.tab === 'buy') {
      const items = ITEMS.filter((i) => i.shop)
        .sort((a, b) => a.minLevel - b.minLevel || a.price - b.price)
        .map((item) => {
          const err = closed ?? canBuy(p, item.id);
          return itemRow(p, item, `<button class="btn btn-gold sm" data-action="buy" data-id="${item.id}" ${err ? `disabled title="${esc(err)}"` : ''}>${icon('coin', 'xs')} ${item.price}</button>`);
        })
        .join('');
      return tabs + banner + coins + `<div class="items">${items}</div>`;
    }
    const items = p.inventory
      .filter((i) => !isEquipped(p, i.uid))
      .map((inv) => {
        const item = invItem(inv);
        return item ? itemRow(p, item, `<button class="btn sm" data-action="sell" data-id="${inv.uid}" ${closed ? `disabled title="${esc(closed)}"` : ''}>${t('market.sellFor', { n: sellPrice(item, inv.plus) })}</button>`) : '';
      })
      .join('');
    return tabs + banner + coins + `<div class="items">${items || `<p class="dim">${t('market.nothingToSell')}</p>`}</div>`;
  }

  onAction(action: string, el: HTMLElement, p: PlayerState): void {
    const id = el.dataset.id ?? '';
    const closed = canTrade(p);
    if (closed && (action === 'buy' || action === 'sell' || action === 'upgrade' || action === 'forge')) {
      sound.play('error');
      toast(closed, 'bad');
      return;
    }
    if (action === 'tab') {
      this.tab = (['sell', 'upgrades', 'forge', 'merchant'] as Tab[]).includes(id as Tab) ? (id as Tab) : 'buy';
      this.d.actions.rerender();
    } else if (action === 'forge') {
      const r = this.d.store.update((pl) => forgeItem(pl, id));
      if (r.error) {
        sound.play('error');
        toast(r.error, 'bad');
      } else {
        sound.play('forge');
        this.d.actions.smithSay(t('forge.done', { n: r.plus }));
        toast(t('forge.toast', { name: r.name, n: r.plus }), 'gold', 4000);
        this.d.actions.refreshVisual();
      }
    } else if (action === 'merchant-buy') {
      const err = this.d.store.update((pl) => buyFromMerchant(pl, id));
      if (err) {
        sound.play('error');
        toast(err, 'bad');
      } else {
        sound.play('coin');
        const item = getItem(id);
        toast(t('event.merchantBought', { name: item ? itemName(item) : id }), 'gold', 4000);
      }
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
      const item = invItem(inv);
      if (!item) return;
      void confirmModal(t('market.sellTitle'), t('market.sellBody', { name: itemName(item), n: sellPrice(item, inv?.plus) }), t('market.sell')).then((ok) => {
        if (!ok) return;
        const r = this.d.store.update((pl) => sellItem(pl, id));
        toast(r.message, r.ok ? 'good' : 'bad');
        sound.play(r.ok ? 'coin' : 'error');
      });
    }
  }
}
