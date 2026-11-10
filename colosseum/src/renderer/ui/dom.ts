// Utilitários de DOM. Todo texto dinâmico passa por esc() antes de virar HTML.
import type { ItemDef, ItemMods } from '../core/model/types';
import { ATTRIBUTE_KEYS } from '../core/model/types';
import { t } from '../i18n';
import { attrShort, itemName } from '../i18n/data';
import { RARITY_COLOR } from '../core/data/equipment';

export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function $(sel: string, root: ParentNode = document): HTMLElement {
  const el = root.querySelector(sel);
  if (!el) throw new Error(`Elemento não encontrado: ${sel}`);
  return el as HTMLElement;
}

export function icon(name: string, cls = ''): string {
  return `<img class="px-icon ${cls}" src="assets/ui/icons/${esc(name)}.png" alt="" draggable="false">`;
}

export function itemIcon(item: ItemDef, cls = ''): string {
  const tint = item.visual.tint ? `style="--tint:#${item.visual.tint.toString(16).padStart(6, '0')}"` : '';
  return `<span class="item-icon rarity-${item.rarity} ${item.visual.tint ? 'tinted' : ''} ${cls}" ${tint}><img src="assets/ui/items/${esc(item.visual.icon)}.png" alt="" draggable="false"></span>`;
}

export function rarityName(item: ItemDef): string {
  return `<span class="item-name" style="color:${RARITY_COLOR[item.rarity]}">${esc(itemName(item))}${item.plus ? ` <b class="plus">+${item.plus}</b>` : ''}</span>`;
}

export function bar(value: number, max: number, cls: string, label = true): string {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return `<div class="bar ${cls}"><div class="bar-fill" style="width:${pct.toFixed(1)}%"></div>${
    label ? `<span class="bar-label">${Math.round(value)} / ${Math.round(max)}</span>` : ''
  }</div>`;
}

export function modsSummary(m: ItemMods): string {
  const parts: string[] = [];
  if (m.damage) parts.push(`${t('stat.damage')} +${m.damage}`);
  if (m.defense) parts.push(`${t('stat.defense')} +${m.defense}`);
  if (m.reach) parts.push(`${t('stat.reach')} ${m.reach}`);
  if (m.block) parts.push(`${t('stat.block')} ${Math.round(m.block * 100)}%`);
  if (m.attackSpeed) parts.push(`${t('stat.speed')} ${m.attackSpeed < 0 ? '+' : '−'}${Math.abs(m.attackSpeed).toFixed(2)}s`);
  for (const k of ATTRIBUTE_KEYS) {
    const v = m.attrs?.[k];
    if (v) parts.push(`${attrShort(k)} ${v > 0 ? '+' : ''}${v}`);
  }
  return parts.join(' · ');
}

export function fmtDate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}
