// Templo de Marte: árvore de habilidades em três caminhos.
import type { PlayerState } from '../../core/model/types';
import { BRANCHES, PERKS, getPerk, type BranchId, type PerkDef } from '../../core/data/skillTree';
import { canLearn, learn, respec, respecCost } from '../../core/systems/SkillTreeSystem';
import { esc, icon } from '../dom';
import { confirmModal, toast } from '../components/feedback';
import { sound } from '../../audio/SoundManager';
import type { Screen, ScreenDeps } from './Screen';
import { t } from '../../i18n';
import { weatherAt } from '../../core/systems/WeatherSystem';
import { branchName, branchSubtitle, perkName, perkShort } from '../../i18n/data';

export class TempleScreen implements Screen {
  readonly id = 'temple' as const;
  get title() {
    return t('temple.title');
  }
  get tip() {
    return t('temple.tip');
  }
  private selected: string | null = null;

  constructor(private readonly d: ScreenDeps) {}

  private node(p: PlayerState, perk: PerkDef): string {
    const owned = p.perks.includes(perk.id);
    const err = canLearn(p, perk.id);
    const state = owned ? 'owned' : !err ? 'available' : perk.requires.some((r) => p.perks.includes(r)) || !perk.requires.length ? 'poor' : 'locked';
    return `<button class="perk perk-${state} ${this.selected === perk.id ? 'sel' : ''}" data-action="select" data-id="${perk.id}">
      ${icon(perk.icon)}<span>${esc(perkName(perk))}</span><i>${'●'.repeat(perk.cost)}</i></button>`;
  }

  render(p: PlayerState): string {
    const cols = (Object.keys(BRANCHES) as BranchId[])
      .map((b) => {
        const br = BRANCHES[b];
        const tiers = [1, 2, 3, 4, 5]
          .map((t) => `<div class="tier">${PERKS.filter((pk) => pk.branch === b && pk.tier === t).map((pk) => this.node(p, pk)).join('')}</div>`)
          .join('<div class="link"></div>');
        return `<div class="branch" style="--bc:${br.color}"><div class="branch-head"><b>${branchName(b)}</b><small>${branchSubtitle(b)}</small></div>${tiers}</div>`;
      })
      .join('');
    const sel = this.selected ? getPerk(this.selected) : undefined;
    let detail = `<p class="hint center">${t('temple.pick')}</p>`;
    if (sel) {
      const owned = p.perks.includes(sel.id);
      const err = canLearn(p, sel.id);
      detail = `<div class="perk-detail"><div class="row">${icon(sel.icon)}<b>${esc(perkName(sel))}</b><span class="tag">${t('temple.cost', { n: sel.cost })}</span></div>
        <p>${esc(perkShort(sel))}</p>
        ${owned ? `<p class="gold">${t('temple.learned')}</p>` : `<button class="btn btn-gold wide" data-action="learn" data-id="${sel.id}" ${err ? 'disabled' : ''}>${err ? esc(err) : t('temple.learn')}</button>`}</div>`;
    }
    const say = p.skillPoints
      ? p.perks.length
        ? t('monk.continue')
        : t('monk.choose')
      : t('monk.later');
    const rain = weatherAt(p.createdAt, p.day, p.minutes).rain > 0.08 ? `<p class="hint">${t('temple.rainNote')}</p>` : '';
    return `<div class="monk-say"><b>${t('monk.name')}:</b><span>“${say}”</span></div>${rain}
      <div class="row between"><span class="big-num">${p.skillPoints} <small>${t('temple.points')}</small></span>
        <button class="btn sm btn-dark" data-action="respec" ${p.perks.length ? '' : 'disabled'}>${t('temple.respec', { cost: respecCost(p) })}</button></div>
      <div class="tree">${cols}</div>
      ${detail}`;
  }

  onAction(action: string, el: HTMLElement, p: PlayerState): void {
    const id = el.dataset.id ?? '';
    if (action === 'select') {
      this.selected = id;
      this.d.actions.rerender();
    } else if (action === 'learn') {
      const err = this.d.store.update((pl) => learn(pl, id));
      if (err) {
        toast(err, 'bad');
        sound.play('error');
      } else {
        const pk = getPerk(id);
        toast(t('temple.taught', { name: pk ? perkName(pk) : id }), 'gold');
        sound.play('levelup');
      }
    } else if (action === 'respec') {
      void confirmModal(t('temple.respecTitle'), t('temple.respecBody', { cost: respecCost(p) }), t('temple.respecOk')).then((ok) => {
        if (!ok) return;
        const err = this.d.store.update((pl) => respec(pl));
        toast(err ?? t('temple.respecDone'), err ? 'bad' : 'good');
      });
    }
  }
}
