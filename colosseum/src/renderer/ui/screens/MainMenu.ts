// Tela "Arena": apresenta o gladiador, a estratégia e a seleção do próximo adversário.
import type { PlayerState, StrategyId } from '../../core/model/types';
import { ATTRIBUTE_KEYS } from '../../core/model/types';
import { ATTRIBUTE_INFO } from '../../core/data/gladiators';
import { OPPONENTS, getOpponent } from '../../core/data/opponents';
import { STRATEGIES } from '../../core/data/skills';
import { isUnlocked, reputationTitle } from '../../core/systems/ProgressionSystem';
import { playerCombatStats } from '../../core/systems/AttributeSystem';
import { opponentGear } from '../../core/combat/CombatantFactory';
import { esc, icon, itemIcon } from '../dom';
import type { Screen, ScreenDeps } from './Screen';

function difficulty(chance: number): { label: string; cls: string } {
  if (chance >= 0.75) return { label: 'Fácil', cls: 'diff-easy' };
  if (chance >= 0.5) return { label: 'Equilibrado', cls: 'diff-even' };
  if (chance >= 0.25) return { label: 'Difícil', cls: 'diff-hard' };
  return { label: 'Muito difícil', cls: 'diff-vhard' };
}

export class MainMenu implements Screen {
  readonly id = 'arena' as const;
  readonly title = 'Arena';
  readonly tip =
    'Escolha uma estratégia e um adversário e clique em LUTAR. O combate é automático: seu gladiador age sozinho de acordo com atributos, equipamentos, habilidades e estratégia.';

  constructor(private readonly d: ScreenDeps) {}

  render(p: PlayerState): string {
    const { attrs, stats } = playerCombatStats(p);
    const sel = getOpponent(p.selectedOpponent) ?? OPPONENTS[0];
    const selUnlocked = isUnlocked(p, sel.id);
    const chance = selUnlocked ? this.d.actions.winChance(sel.id) : 0;
    const diff = difficulty(chance);
    const attrsHtml = ATTRIBUTE_KEYS.map(
      (k) => `<div class="mini-attr" title="${esc(ATTRIBUTE_INFO[k].name)}">${icon(ATTRIBUTE_INFO[k].icon)}<b>${attrs[k]}</b></div>`,
    ).join('');
    const strategies = (Object.keys(STRATEGIES) as StrategyId[])
      .map(
        (s) =>
          `<button class="btn strat ${p.strategy === s ? 'active' : ''}" data-action="strategy" data-id="${s}" title="${esc(STRATEGIES[s].description)}">${esc(STRATEGIES[s].name)}</button>`,
      )
      .join('');
    const opps = OPPONENTS.map((o, i) => {
      const unlocked = isUnlocked(p, o.id);
      const beaten = p.defeatedOpponents.includes(o.id);
      const gear = Object.values(opponentGear(o))
        .map((it) => (it ? itemIcon(it, 'xs') : ''))
        .join('');
      if (!unlocked) {
        return `<div class="opp locked"><div class="opp-head"><span class="opp-name">???</span><span class="lvl">Nv ${o.level}</span></div>
          <div class="opp-desc">Derrote ${esc(OPPONENTS[i - 1].name)} para desbloquear.</div></div>`;
      }
      return `<button class="opp ${o.id === sel.id ? 'selected' : ''}" data-action="select" data-id="${o.id}">
        <div class="opp-head"><span class="opp-name">${esc(o.name)}, <i>${esc(o.epithet)}</i></span>${beaten ? icon('laurel', 'sm') : ''}<span class="lvl">Nv ${o.level}</span></div>
        <div class="opp-desc">${esc(o.description)}</div>
        <div class="opp-gear">${gear}<span class="opp-strat">${esc(STRATEGIES[o.strategy].name)}</span></div>
      </button>`;
    }).join('');

    return `
      <div class="card hero-card">
        <div class="row between"><h2>${esc(p.name)}</h2><span class="lvl big">Nível ${p.level}</span></div>
        <div class="subtitle">${esc(reputationTitle(p.reputation))} · ${p.stats.wins}V / ${p.stats.losses}D</div>
        <div class="mini-attrs">${attrsHtml}</div>
        <div class="row stats-line"><span>Vida <b>${stats.maxHp}</b></span><span>Resist. <b>${stats.maxStamina}</b></span><span>Dano <b>${Math.round(stats.baseDamage)}</b></span><span>Defesa <b>${Math.round(stats.damageReduction * 100)}%</b></span></div>
        ${p.unspentPoints > 0 ? `<button class="btn btn-gold wide" data-action="goto" data-id="gladiator">Você tem ${p.unspentPoints} pontos de atributo para distribuir</button>` : ''}
      </div>
      <h3>Estratégia</h3>
      <div class="row strategies">${strategies}</div>
      <p class="hint">${esc(STRATEGIES[p.strategy].description)}</p>
      <h3>Próximo adversário</h3>
      <div class="fight-box card">
        <div class="row between"><span>${esc(sel.name)}, ${esc(sel.epithet)} — Nv ${sel.level}</span>
        ${selUnlocked ? `<span class="diff ${diff.cls}" title="Estimativa baseada em simulações das suas estatísticas atuais">${diff.label} · ${Math.round(chance * 100)}%</span>` : ''}</div>
        <button class="btn btn-red btn-fight" data-action="fight" ${selUnlocked ? '' : 'disabled'}>LUTAR!</button>
        <label class="check"><input type="checkbox" data-action="auto" ${p.settings.autoContinue ? 'checked' : ''}> Lutas contínuas (revanche automática ao final de cada luta)</label>
      </div>
      <div class="opp-list">${opps}</div>`;
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
        this.d.actions.goTab('gladiator');
        break;
    }
  }
}
