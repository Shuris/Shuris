// Tela do gladiador: atributos (com distribuição de pontos), estatísticas e habilidades.
import type { AttributeKey, PlayerState, SkillId, Slot } from '../../core/model/types';
import { ATTRIBUTE_KEYS } from '../../core/model/types';
import { ATTRIBUTE_INFO, MAX_ATTRIBUTE, MAX_LEVEL } from '../../core/data/gladiators';
import { SKILLS } from '../../core/data/skills';
import { getItem } from '../../core/data/equipment';
import { equipItem, isEquipped, unequipSlot } from '../../core/systems/EquipmentSystem';
import { skillsFromPerks } from '../../core/systems/SkillTreeSystem';
import { equippedSlots, itemRow } from '../components/items';
import { sound } from '../../audio/SoundManager';
import { allocatePoints, computeCombatStats, equippedItems, finalAttributes, gearAttributeBonus, naturalAttributes } from '../../core/systems/AttributeSystem';
import { xpToNext } from '../../core/systems/ProgressionSystem';
import { bar, esc, icon } from '../dom';
import { toast } from '../components/feedback';
import type { Screen, ScreenDeps } from './Screen';

const ATTR_HINT: Record<AttributeKey, string> = {
  str: 'mais dano',
  vit: 'mais vida',
  res: 'menos dano e cansaço',
  agi: 'ataca mais rápido, esquiva',
  prec: 'acerta mais, críticos',
  tech: 'habilidades e defesa',
};

const SKILL_HINT: Record<SkillId, string> = {
  power_strike: 'Golpe muito forte.',
  iron_guard: 'Reduz o dano por alguns segundos.',
  quick_strike: 'Golpe veloz quando o rival se abre.',
  counter: 'Revida após defender ou esquivar.',
};

export class CharacterScreen implements Screen {
  readonly id = 'gladiator' as const;
  readonly title = 'Gladiador';
  readonly tip = 'Ao subir de nível você ganha 3 pontos. Use + e confirme.';
  private tab: 'attrs' | 'gear' = 'attrs';
  private pending: Record<AttributeKey, number> = { str: 0, vit: 0, res: 0, agi: 0, prec: 0, tech: 0 };

  constructor(private readonly d: ScreenDeps) {}

  private pendingTotal(): number {
    return ATTRIBUTE_KEYS.reduce((s, k) => s + this.pending[k], 0);
  }

  onOpen(p: PlayerState): void {
    if (p.unspentPoints > 0) this.tab = 'attrs';
  }

  render(p: PlayerState): string {
    const tabs = `<div class="subtabs"><button class="btn ${this.tab === 'attrs' ? 'active' : ''}" data-action="tab" data-id="attrs">Atributos</button><button class="btn ${this.tab === 'gear' ? 'active' : ''}" data-action="tab" data-id="gear">Equipamento</button></div>`;
    return tabs + (this.tab === 'gear' ? this.renderGear(p) : this.renderAttrs(p));
  }

  private renderGear(p: PlayerState): string {
    const items = p.inventory
      .filter((i) => !isEquipped(p, i.uid))
      .map((inv) => {
        const item = getItem(inv.itemId);
        return item ? itemRow(p, item, `<button class="btn btn-gold sm" data-action="equip" data-id="${inv.uid}" ${p.level < item.minLevel ? 'disabled' : ''}>Equipar</button>`) : '';
      })
      .join('');
    return `<div class="slots card">${equippedSlots(p, true)}</div>
      <h3>Guardados</h3>
      <div class="items">${items || '<p class="dim">Nada guardado. Compre no Mercado.</p>'}</div>`;
  }

  private renderAttrs(p: PlayerState): string {
    if (this.pendingTotal() > p.unspentPoints) this.reset();
    const gear = equippedItems(p);
    const nat = naturalAttributes(p);
    const gb = gearAttributeBonus(gear);
    const planned = { ...nat };
    for (const k of ATTRIBUTE_KEYS) planned[k] += this.pending[k];
    const before = computeCombatStats(finalAttributes(nat, gear), gear);
    const after = computeCombatStats(finalAttributes(planned, gear), gear);
    const left = p.unspentPoints - this.pendingTotal();
    const rows = ATTRIBUTE_KEYS.map((k) => {
      const info = ATTRIBUTE_INFO[k];
      const value = p.baseAttributes[k] + p.trainedBonus[k];
      const canAdd = left > 0 && value + this.pending[k] < MAX_ATTRIBUTE;
      const extra = gb[k] ? ` <em class="${gb[k] > 0 ? 'up' : 'down'}">${gb[k] > 0 ? '+' : ''}${gb[k]}</em>` : '';
      return `<div class="attr-row" title="${esc(info.description)}">
        ${icon(info.icon)}
        <span class="attr-name">${esc(info.name)}<small>${ATTR_HINT[k]}</small></span>
        <span class="attr-val">${value + this.pending[k]}${this.pending[k] ? `<em class="up"> +${this.pending[k]}</em>` : ''}${extra}</span>
        ${p.unspentPoints > 0 ? `<button class="btn sq" data-action="minus" data-id="${k}" ${this.pending[k] ? '' : 'disabled'}>−</button><button class="btn sq btn-gold" data-action="plus" data-id="${k}" ${canAdd ? '' : 'disabled'}>+</button>` : ''}
      </div>`;
    }).join('');
    const stat = (label: string, a: number, b: number, fmt: (v: number) => string, betterHigh = true) => {
      const diff = b - a;
      const good = betterHigh ? diff > 0 : diff < 0;
      return `<div class="stat"><span>${label}</span><b>${fmt(b)}</b>${Math.abs(diff) > 1e-6 ? `<em class="${good ? 'up' : 'down'}">▲</em>` : ''}</div>`;
    };
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const learned = skillsFromPerks(p.perks);
    const skills = learned.length
      ? learned
          .map((id) => {
            const s = SKILLS[id];
            return `<div class="skill" title="${esc(s.description)}">${icon(s.icon)}<div><b>${esc(s.name)}</b><p>${SKILL_HINT[id]}</p></div></div>`;
          })
          .join('')
      : '<p class="dim">Nenhuma ainda. Aprenda no Templo de Marte.</p>';
    return `
      <div class="card">
        <div class="row between"><span class="hero-name">${esc(p.name)}</span><span class="lvl big">Nível ${p.level}</span></div>
        ${p.level < MAX_LEVEL ? bar(p.xp, xpToNext(p.level), 'xp') : ''}
      </div>
      <h3>Atributos ${p.unspentPoints > 0 ? `<span class="tag gold">${left} pontos</span>` : ''}</h3>
      <div class="attrs">${rows}</div>
      ${this.pendingTotal() > 0 ? `<div class="row end"><button class="btn" data-action="cancel">Cancelar</button><button class="btn btn-gold" data-action="confirm">Confirmar</button></div>` : ''}
      <h3>Em combate</h3>
      <div class="stats-grid">
        ${stat('Vida', before.maxHp, after.maxHp, (v) => String(Math.round(v)))}
        ${stat('Dano', before.baseDamage, after.baseDamage, (v) => v.toFixed(0))}
        ${stat('Defesa', before.damageReduction, after.damageReduction, pct)}
        ${stat('Esquiva', before.dodgeChance, after.dodgeChance, pct)}
        ${stat('Ataque a cada', before.attackInterval, after.attackInterval, (v) => `${v.toFixed(1)}s`, false)}
        ${stat('Crítico', before.critChance, after.critChance, pct)}
      </div>
      <h3>Habilidades ${p.skillPoints ? `<span class="tag gold">${p.skillPoints} p/ o Templo</span>` : ''}</h3>
      <div class="skills">${skills}</div>`;
  }

  private reset(): void {
    for (const k of ATTRIBUTE_KEYS) this.pending[k] = 0;
  }

  onAction(action: string, el: HTMLElement, p: PlayerState): void {
    if (action === 'tab') {
      this.tab = el.dataset.id === 'gear' ? 'gear' : 'attrs';
      return this.d.actions.rerender();
    }
    if (action === 'equip' || action === 'unequip') {
      const id = el.dataset.id ?? '';
      const r = this.d.store.update((pl) => (action === 'equip' ? equipItem(pl, id) : unequipSlot(pl, id as Slot)));
      toast(r.message, r.ok ? 'good' : 'bad');
      sound.play(r.ok ? 'equip' : 'error');
      this.d.actions.refreshVisual();
      return;
    }
    const k = el.dataset.id as AttributeKey;
    if (action === 'plus' && this.pendingTotal() < p.unspentPoints) this.pending[k]++;
    else if (action === 'minus' && this.pending[k] > 0) this.pending[k]--;
    else if (action === 'cancel') this.reset();
    else if (action === 'confirm') {
      const alloc = { ...this.pending };
      const err = this.d.store.update((pl) => allocatePoints(pl, alloc));
      if (err) toast(err, 'bad');
      else {
        toast('Atributos melhorados!', 'good');
        this.reset();
      }
    }
    this.d.actions.rerender();
  }
}
