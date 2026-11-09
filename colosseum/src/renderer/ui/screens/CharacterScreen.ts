// Tela do gladiador: atributos, distribuição de pontos, estatísticas derivadas e habilidades.
import type { AttributeKey, PlayerState } from '../../core/model/types';
import { ATTRIBUTE_KEYS } from '../../core/model/types';
import { ATTRIBUTE_INFO, MAX_ATTRIBUTE, getOrigin } from '../../core/data/gladiators';
import { SKILLS, SKILL_ORDER } from '../../core/data/skills';
import {
  allocatePoints,
  computeCombatStats,
  equippedItems,
  finalAttributes,
  gearAttributeBonus,
  naturalAttributes,
} from '../../core/systems/AttributeSystem';
import { reputationTitle, xpToNext } from '../../core/systems/ProgressionSystem';
import { MAX_LEVEL } from '../../core/data/gladiators';
import { bar, esc, icon } from '../dom';
import { toast } from '../components/feedback';
import type { Screen, ScreenDeps } from './Screen';

export class CharacterScreen implements Screen {
  readonly id = 'gladiator' as const;
  readonly title = 'Gladiador';
  readonly tip = 'A cada nível você recebe 3 pontos de atributo. Use + e − para planejar e confirme a distribuição. Os valores entre parênteses mostram bônus de treino e de equipamentos.';
  private pending: Record<AttributeKey, number> = { str: 0, vit: 0, res: 0, agi: 0, prec: 0, tech: 0 };

  constructor(private readonly d: ScreenDeps) {}

  private pendingTotal(): number {
    return ATTRIBUTE_KEYS.reduce((s, k) => s + this.pending[k], 0);
  }

  render(p: PlayerState): string {
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
      const extra: string[] = [];
      if (p.trainedBonus[k]) extra.push(`treino +${p.trainedBonus[k]}`);
      if (gb[k]) extra.push(`equip. ${gb[k] > 0 ? '+' : ''}${gb[k]}`);
      const value = p.baseAttributes[k] + p.trainedBonus[k];
      const canAdd = left > 0 && value + this.pending[k] < MAX_ATTRIBUTE;
      return `<div class="attr-row" title="${esc(info.description)}">
        ${icon(info.icon)}<span class="attr-name">${esc(info.name)}</span>
        <span class="attr-val">${value + this.pending[k]}${this.pending[k] ? ` <em class="up">+${this.pending[k]}</em>` : ''}</span>
        <span class="attr-extra">${extra.length ? `(${esc(extra.join(', '))})` : ''}</span>
        ${p.unspentPoints > 0 ? `<button class="btn sq" data-action="minus" data-id="${k}" ${this.pending[k] ? '' : 'disabled'}>−</button><button class="btn sq" data-action="plus" data-id="${k}" ${canAdd ? '' : 'disabled'}>+</button>` : ''}
      </div>`;
    }).join('');
    const stat = (label: string, a: number, b: number, fmt: (v: number) => string, betterHigh = true) => {
      const diff = b - a;
      const show = Math.abs(diff) > 1e-6;
      const good = betterHigh ? diff > 0 : diff < 0;
      return `<div class="stat"><span>${label}</span><b>${fmt(b)}</b>${show ? `<em class="${good ? 'up' : 'down'}">${fmt(a)}→</em>` : ''}</div>`;
    };
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const skills = SKILL_ORDER.map((id) => {
      const s = SKILLS[id];
      const unlocked = p.level >= s.unlockLevel;
      return `<div class="skill ${unlocked ? '' : 'locked'}">${icon(s.icon)}<div><b>${esc(s.name)}</b>${unlocked ? '' : ` <span class="tag">Nível ${s.unlockLevel}</span>`}
        <p>${esc(s.description)}</p><p class="hint">${esc(s.trigger)}</p></div></div>`;
    }).join('');
    const need = xpToNext(p.level);
    return `
      <div class="card">
        <div class="row between"><h2>${esc(p.name)}</h2><span class="lvl big">Nível ${p.level}${p.level >= MAX_LEVEL ? ' (máx.)' : ''}</span></div>
        <div class="subtitle">${esc(getOrigin(p.origin).name)} · ${esc(reputationTitle(p.reputation))} · Reputação ${p.reputation}</div>
        ${p.level < MAX_LEVEL ? bar(p.xp, need, 'xp') : ''}
      </div>
      <h3>Atributos ${p.unspentPoints > 0 ? `<span class="tag gold">${left} ponto(s) disponível(is)</span>` : ''}</h3>
      <div class="attrs">${rows}</div>
      ${this.pendingTotal() > 0 ? `<div class="row end"><button class="btn" data-action="cancel">Cancelar</button><button class="btn btn-gold" data-action="confirm">Confirmar distribuição</button></div>` : ''}
      <h3>Estatísticas de combate</h3>
      <div class="stats-grid">
        ${stat('Vida máxima', before.maxHp, after.maxHp, (v) => String(Math.round(v)))}
        ${stat('Resistência máx.', before.maxStamina, after.maxStamina, (v) => String(Math.round(v)))}
        ${stat('Dano básico', before.baseDamage, after.baseDamage, (v) => v.toFixed(1))}
        ${stat('Redução de dano', before.damageReduction, after.damageReduction, pct)}
        ${stat('Esquiva', before.dodgeChance, after.dodgeChance, pct)}
        ${stat('Intervalo de ataque', before.attackInterval, after.attackInterval, (v) => `${v.toFixed(2)}s`, false)}
        ${stat('Crítico', before.critChance, after.critChance, pct)}
        ${stat('Bloqueio', before.blockPower, after.blockPower, pct)}
        ${stat('Alcance', before.reach, after.reach, (v) => String(v))}
        ${stat('Recuperação de fôlego', before.staminaRegen, after.staminaRegen, (v) => `${v.toFixed(1)}/s`)}
      </div>
      <h3>Habilidades</h3>
      <div class="skills">${skills}</div>`;
  }

  private reset(): void {
    for (const k of ATTRIBUTE_KEYS) this.pending[k] = 0;
  }

  onAction(action: string, el: HTMLElement, p: PlayerState): void {
    const k = el.dataset.id as AttributeKey;
    if (action === 'plus' && this.pendingTotal() < p.unspentPoints) this.pending[k]++;
    else if (action === 'minus' && this.pending[k] > 0) this.pending[k]--;
    else if (action === 'cancel') this.reset();
    else if (action === 'confirm') {
      const alloc = { ...this.pending };
      const err = this.d.store.update((pl) => allocatePoints(pl, alloc));
      if (err) toast(err, 'bad');
      else {
        toast('Atributos atualizados!', 'good');
        this.reset();
      }
      this.d.actions.rerender();
      return;
    }
    this.d.actions.rerender();
  }
}
