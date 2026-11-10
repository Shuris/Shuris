// Ferreiro (no mercado): melhora armas, escudos e armaduras de +1 até +3.
import type { PlayerState } from '../model/types';
import { MAX_PLUS, forgeCost, forgeLevel, getItem } from '../data/equipment';
import { advance, DAY_END, type Check } from './CalendarSystem';
import { canTrade } from './CalendarSystem';
import { t } from '../../i18n';
import { itemName } from '../../i18n/data';

export const FORGE_MINUTES = 30;

export function canForge(p: PlayerState, uid: string): Check {
  const closed = canTrade(p);
  if (closed) return closed;
  const inv = p.inventory.find((i) => i.uid === uid);
  const item = inv ? getItem(inv.itemId) : undefined;
  if (!inv || !item) return t('err.itemNotFound');
  if (item.id === 'rudis') return t('forge.noWood');
  const plus = inv.plus ?? 0;
  if (plus >= MAX_PLUS) return t('forge.max');
  if (p.level < forgeLevel(item, plus)) return t('err.needLevel', { n: forgeLevel(item, plus) });
  if (p.coins < forgeCost(item, plus)) return t('err.noCoins');
  if (p.minutes + FORGE_MINUTES > DAY_END) return t('cal.tooLate');
  return null;
}

export function forgeItem(p: PlayerState, uid: string): { error: Check; plus: number; name: string } {
  const err = canForge(p, uid);
  const inv = p.inventory.find((i) => i.uid === uid);
  const item = inv ? getItem(inv.itemId) : undefined;
  if (err || !inv || !item) return { error: err ?? t('err.itemNotFound'), plus: inv?.plus ?? 0, name: '' };
  const plus = inv.plus ?? 0;
  p.coins -= forgeCost(item, plus);
  inv.plus = plus + 1;
  advance(p, FORGE_MINUTES);
  return { error: null, plus: inv.plus, name: itemName(item) };
}
