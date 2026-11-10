// Tela "Arena": o gladiador, a estratégia e o próximo adversário — com o mínimo de texto.
import type { PlayerState, StrategyId } from '../../core/model/types';
import { OPPONENTS, getOpponent } from '../../core/data/opponents';
import { ARENAS, arenaForOpponent } from '../../core/data/arenas';
import { STRATEGIES } from '../../core/data/skills';
import { isUnlocked } from '../../core/systems/ProgressionSystem';
import { playerCombatStats } from '../../core/systems/AttributeSystem';
import { opponentGear } from '../../core/combat/CombatantFactory';
import { esc, icon, itemIcon } from '../dom';
import { FIGHT_ENERGY, canFight } from '../../core/systems/CalendarSystem';
import type { Screen, ScreenDeps } from './Screen';
import { t } from '../../i18n';
import { arenaName, opponentDesc, opponentEpithet, strategyName } from '../../i18n/data';


export function difficulty(chance: number): { label: string; cls: string } {
  if (chance >= 0.75) return { label: t('diff.easy'), cls: 'diff-easy' };
  if (chance >= 0.5) return { label: t('diff.even'), cls: 'diff-even' };
  if (chance >= 0.25) return { label: t('diff.hard'), cls: 'diff-hard' };
  return { label: t('diff.vhard'), cls: 'diff-vhard' };
}

export class MainMenu implements Screen {
  readonly id = 'arena' as const;
  get title() {
    return t('arena.title');
  }
  get tip() {
    return t('arena.tip');
  }

  constructor(private readonly d: ScreenDeps) {}

  render(p: PlayerState): string {
    const { stats } = playerCombatStats(p);
    const sel = getOpponent(p.selectedOpponent) ?? OPPONENTS[0];
    const selUnlocked = isUnlocked(p, sel.id);
    const chance = selUnlocked ? this.d.actions.winChance(sel.id) : 0;
    const diff = difficulty(chance);
    const fightErr = canFight(p);
    const strategies = (Object.keys(STRATEGIES) as StrategyId[])
      .map((s) => `<button class="btn strat ${p.strategy === s ? 'active' : ''}" data-action="strategy" data-id="${s}">${esc(strategyName(s))}</button>`)
      .join('');

    const groups = ARENAS.map((arena) => {
      const opps = OPPONENTS.filter((o) => arenaForOpponent(o.id).id === arena.id);
      const cards = opps
        .map((o) => {
          const unlocked = isUnlocked(p, o.id);
          const beaten = p.defeatedOpponents.includes(o.id);
          if (!unlocked) return `<div class="opp locked"><span class="opp-name">??? </span><span class="lvl">${t('common.lv', { n: o.level })}</span></div>`;
          const gear = Object.values(opponentGear(o))
            .map((it) => (it ? itemIcon(it, 'xs') : ''))
            .join('');
          return `<button class="opp ${o.id === sel.id ? 'selected' : ''}" data-action="select" data-id="${o.id}" title="${esc(`${o.name}, ${opponentEpithet(o)} — ${opponentDesc(o)}`)}">
            <span class="opp-name">${esc(o.name)} ${beaten ? icon('laurel', 'sm') : ''}</span>
            <span class="opp-gear">${gear}</span>
            <span class="lvl">${t('common.lv', { n: o.level })}</span>
          </button>`;
        })
        .join('');
      return `<div class="arena-group"><div class="arena-name">${esc(arenaName(arena))}</div>${cards}</div>`;
    }).join('');

    return `
      <div class="card hero-card">
        <div class="row between"><span class="hero-name">${esc(p.name)}</span><span class="lvl big">${t('common.level', { n: p.level })}</span></div>
        <div class="big-stats">
          <span title="${t('stat.maxHp')}">${icon('attr_vit')} ${stats.maxHp}</span>
          <span title="${t('stat.baseDamage')}">${icon('attr_str')} ${Math.round(stats.baseDamage)}</span>
          <span title="${t('stat.reduction')}">${icon('attr_res')} ${Math.round(stats.damageReduction * 100)}%</span>
        </div>
        ${p.unspentPoints > 0 ? `<button class="btn btn-gold wide" data-action="goto">${t('arena.pointsToUse', { n: p.unspentPoints })}</button>` : ''}
      </div>
      <div class="fight-box">
        <button class="btn btn-red btn-fight" data-action="fight" ${selUnlocked && !fightErr ? '' : 'disabled'}>${t('arena.fight')}</button>
        <p class="hint center ${fightErr ? 'red' : ''}">${fightErr ?? t('arena.cost', { energy: FIGHT_ENERGY })}</p>
        <div class="row between fight-info">
          <span>vs <b>${esc(sel.name)}</b> · ${esc(arenaName(arenaForOpponent(sel.id)))}</span>
          ${selUnlocked ? `<span class="diff ${diff.cls}" title="${t('arena.chance')}">${diff.label} ${Math.round(chance * 100)}%</span>` : ''}
        </div>
      </div>
      <h3>${t('arena.strategy')}</h3>
      <div class="row strategies">${strategies}</div>
      <p class="hint">${t(`strat.hint.${p.strategy}` as 'strat.hint.balanced')}</p>
      <label class="check"><input type="checkbox" data-action="auto" ${p.settings.autoContinue ? 'checked' : ''}> ${t('arena.autoRematch')}</label>
      <h3>${t('arena.opponents')}</h3>
      <div class="opp-list">${groups}</div>`;
  }

  onAction(action: string, el: HTMLElement): void {
    const id = el.dataset.id ?? '';
    switch (action) {
      case 'strategy':
        if (id in STRATEGIES) this.d.store.update((p) => (p.strategy = id as StrategyId));
        break;
      case 'select':
        if (getOpponent(id)) this.d.store.update((p) => (p.selectedOpponent = id));
        break;
      case 'fight':
        this.d.actions.startBattle();
        break;
      case 'auto':
        this.d.store.update((p) => (p.settings.autoContinue = (el as HTMLInputElement).checked));
        break;
      case 'goto':
        this.d.actions.open('gladiator');
        break;
    }
  }
}
