// Templo de Marte: árvore de habilidades em três caminhos.
import type { PlayerState } from '../../core/model/types';
import { BRANCHES, PERKS, getPerk, type BranchId, type PerkDef } from '../../core/data/skillTree';
import { canLearn, learn, respec, respecCost } from '../../core/systems/SkillTreeSystem';
import { esc, icon } from '../dom';
import { confirmModal, toast } from '../components/feedback';
import { sound } from '../../audio/SoundManager';
import type { Screen, ScreenDeps } from './Screen';

export class TempleScreen implements Screen {
  readonly id = 'temple' as const;
  readonly title = 'Templo de Marte';
  readonly tip = 'O monge Aurelius ensina as habilidades. Você ganha 1 ponto por nível.';
  private selected: string | null = null;

  constructor(private readonly d: ScreenDeps) {}

  private node(p: PlayerState, perk: PerkDef): string {
    const owned = p.perks.includes(perk.id);
    const err = canLearn(p, perk.id);
    const state = owned ? 'owned' : !err ? 'available' : perk.requires.some((r) => p.perks.includes(r)) || !perk.requires.length ? 'poor' : 'locked';
    return `<button class="perk perk-${state} ${this.selected === perk.id ? 'sel' : ''}" data-action="select" data-id="${perk.id}" title="${esc(perk.short)}">
      ${icon(perk.icon)}<span>${esc(perk.name)}</span><i>${'●'.repeat(perk.cost)}</i></button>`;
  }

  render(p: PlayerState): string {
    const cols = (Object.keys(BRANCHES) as BranchId[])
      .map((b) => {
        const br = BRANCHES[b];
        const tiers = [1, 2, 3, 4, 5]
          .map((t) => `<div class="tier">${PERKS.filter((pk) => pk.branch === b && pk.tier === t).map((pk) => this.node(p, pk)).join('')}</div>`)
          .join('<div class="link"></div>');
        return `<div class="branch" style="--bc:${br.color}"><div class="branch-head"><b>${br.name}</b><small>${br.subtitle}</small></div>${tiers}</div>`;
      })
      .join('');
    const sel = this.selected ? getPerk(this.selected) : undefined;
    let detail = '<p class="hint center">Toque numa habilidade para ver.</p>';
    if (sel) {
      const owned = p.perks.includes(sel.id);
      const err = canLearn(p, sel.id);
      detail = `<div class="perk-detail"><div class="row">${icon(sel.icon)}<b>${esc(sel.name)}</b><span class="tag">${sel.cost} ponto(s)</span></div>
        <p>${esc(sel.short)}</p>
        ${owned ? '<p class="gold">Aprendida</p>' : `<button class="btn btn-gold wide" data-action="learn" data-id="${sel.id}" ${err ? 'disabled' : ''}>${err ? esc(err) : 'Aprender com o monge'}</button>`}</div>`;
    }
    const say = p.skillPoints
      ? p.perks.length
        ? 'Continue no seu caminho. O que deseja aprender hoje?'
        : 'Marte, Mercúrio ou Minerva... escolha seu caminho, jovem gladiador.'
      : 'Volte quando tiver mais experiência na arena.';
    return `<div class="monk-say"><b>Monge Aurelius:</b><span>“${say}”</span></div>
      <div class="row between"><span class="big-num">${p.skillPoints} <small>pontos</small></span>
        <button class="btn sm btn-dark" data-action="respec" ${p.perks.length ? '' : 'disabled'}>Recomeçar · ${respecCost(p)}</button></div>
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
        toast(`O monge ensinou: ${getPerk(id)?.name}!`, 'gold');
        sound.play('levelup');
      }
    } else if (action === 'respec') {
      void confirmModal('Recomeçar a árvore?', `Devolve todos os pontos por ${respecCost(p)} moedas.`, 'Recomeçar').then((ok) => {
        if (!ok) return;
        const err = this.d.store.update((pl) => respec(pl));
        toast(err ?? 'Pontos devolvidos.', err ? 'bad' : 'good');
      });
    }
  }
}
