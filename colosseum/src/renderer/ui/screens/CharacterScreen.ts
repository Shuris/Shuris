// Tela do gladiador: atributos (com distribuição de pontos), estatísticas e habilidades.
import type { AttributeKey, PlayerState, SkillId, Slot } from '../../core/model/types';
import { ATTRIBUTE_KEYS } from '../../core/model/types';
import { ATTRIBUTE_INFO, MAX_ATTRIBUTE, MAX_LEVEL } from '../../core/data/gladiators';
import { SKILLS } from '../../core/data/skills';
import { invItem } from '../../core/data/equipment';
import { equipItem, isEquipped, unequipSlot } from '../../core/systems/EquipmentSystem';
import { skillsFromPerks } from '../../core/systems/SkillTreeSystem';
import { equippedSlots, itemRow } from '../components/items';
import { sound } from '../../audio/SoundManager';
import { allocatePoints, computeCombatStats, equippedItems, finalAttributes, gearAttributeBonus, naturalAttributes } from '../../core/systems/AttributeSystem';
import { xpToNext } from '../../core/systems/ProgressionSystem';
import { bar, esc, icon } from '../dom';
import { toast } from '../components/feedback';
import type { Screen, ScreenDeps } from './Screen';
import { t } from '../../i18n';
import { attrDesc, attrName, skillDesc, skillName } from '../../i18n/data';

const attrHint = (k: AttributeKey) => t(`attr.hint.${k}` as 'attr.hint.str');
const skillHint = (id: SkillId) => t(`skill.hint.${id}` as 'skill.hint.counter');

export class CharacterScreen implements Screen {
  readonly id = 'gladiator' as const;
  get title() {
    return t('char.title');
  }
  get tip() {
    return t('char.tip');
  }
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
    const tabs = `<div class="subtabs"><button class="btn ${this.tab === 'attrs' ? 'active' : ''}" data-action="tab" data-id="attrs">${t('char.attrs')}</button><button class="btn ${this.tab === 'gear' ? 'active' : ''}" data-action="tab" data-id="gear">${t('char.gear')}</button></div>`;
    return tabs + (this.tab === 'gear' ? this.renderGear(p) : this.renderAttrs(p));
  }

  private renderGear(p: PlayerState): string {
    const items = p.inventory
      .filter((i) => !isEquipped(p, i.uid))
      .map((inv) => {
        const item = invItem(inv);
        return item ? itemRow(p, item, `<button class="btn btn-gold sm" data-action="equip" data-id="${inv.uid}" ${p.level < item.minLevel ? 'disabled' : ''}>${t('char.equip')}</button>`) : '';
      })
      .join('');
    return `<div class="slots card">${equippedSlots(p, true)}</div>
      <h3>${t('char.stored')}</h3>
      <div class="items">${items || `<p class="dim">${t('char.nothingStored')}</p>`}</div>`;
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
      return `<div class="attr-row" title="${esc(attrDesc(k))}">
        ${icon(info.icon)}
        <span class="attr-name">${esc(attrName(k))}<small>${attrHint(k)}</small></span>
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
            return `<div class="skill" title="${esc(skillDesc(id))}">${icon(s.icon)}<div><b>${esc(skillName(id))}</b><p>${skillHint(id)}</p></div></div>`;
          })
          .join('')
      : `<p class="dim">${t('char.noSkills')}</p>`;
    return `
      <div class="card">
        <div class="row between"><span class="hero-name">${esc(p.name)}</span><span class="lvl big">${t('common.level', { n: p.level })}</span></div>
        ${p.level < MAX_LEVEL ? bar(p.xp, xpToNext(p.level), 'xp') : ''}
      </div>
      <h3>${t('char.attrs')} ${p.unspentPoints > 0 ? `<span class="tag gold">${t('char.pointsLeft', { n: left })}</span>` : ''}</h3>
      <div class="attrs">${rows}</div>
      ${this.pendingTotal() > 0 ? `<div class="row end"><button class="btn" data-action="cancel">${t('common.cancel')}</button><button class="btn btn-gold" data-action="confirm">${t('common.confirm')}</button></div>` : ''}
      <h3>${t('char.inCombat')}</h3>
      <div class="stats-grid">
        ${stat(t('stat.hp'), before.maxHp, after.maxHp, (v) => String(Math.round(v)))}
        ${stat(t('stat.damage'), before.baseDamage, after.baseDamage, (v) => v.toFixed(0))}
        ${stat(t('stat.defense'), before.damageReduction, after.damageReduction, pct)}
        ${stat(t('stat.dodge'), before.dodgeChance, after.dodgeChance, pct)}
        ${stat(t('stat.interval'), before.attackInterval, after.attackInterval, (v) => `${v.toFixed(1)}s`, false)}
        ${stat(t('stat.crit'), before.critChance, after.critChance, pct)}
      </div>
      <h3>${t('char.skills')} ${p.skillPoints ? `<span class="tag gold">${t('char.forTemple', { n: p.skillPoints })}</span>` : ''}</h3>
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
        toast(t('char.improved'), 'good');
        this.reset();
      }
    }
    this.d.actions.rerender();
  }
}
