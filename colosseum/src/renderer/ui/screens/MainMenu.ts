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

const STRAT_HINT: Record<StrategyId, string> = {
  aggressive: 'Ataca muito, defende pouco.',
  balanced: 'Ataque e defesa por igual.',
  defensive: 'Defende muito, ataca menos.',
};

export function difficulty(chance: number): { label: string; cls: string } {
  if (chance >= 0.75) return { label: 'Fácil', cls: 'diff-easy' };
  if (chance >= 0.5) return { label: 'Justo', cls: 'diff-even' };
  if (chance >= 0.25) return { label: 'Difícil', cls: 'diff-hard' };
  return { label: 'Muito difícil', cls: 'diff-vhard' };
}

export class MainMenu implements Screen {
  readonly id = 'arena' as const;
  readonly title = 'Arena';
  readonly tip = 'Escolha um adversário e clique em LUTAR. A luta é automática.';

  constructor(private readonly d: ScreenDeps) {}

  render(p: PlayerState): string {
    const { stats } = playerCombatStats(p);
    const sel = getOpponent(p.selectedOpponent) ?? OPPONENTS[0];
    const selUnlocked = isUnlocked(p, sel.id);
    const chance = selUnlocked ? this.d.actions.winChance(sel.id) : 0;
    const diff = difficulty(chance);
    const fightErr = canFight(p);
    const strategies = (Object.keys(STRATEGIES) as StrategyId[])
      .map((s) => `<button class="btn strat ${p.strategy === s ? 'active' : ''}" data-action="strategy" data-id="${s}">${esc(STRATEGIES[s].name)}</button>`)
      .join('');

    const groups = ARENAS.map((arena) => {
      const opps = OPPONENTS.filter((o) => arenaForOpponent(o.id).id === arena.id);
      const cards = opps
        .map((o) => {
          const unlocked = isUnlocked(p, o.id);
          const beaten = p.defeatedOpponents.includes(o.id);
          if (!unlocked) return `<div class="opp locked"><span class="opp-name">??? </span><span class="lvl">Nv ${o.level}</span></div>`;
          const gear = Object.values(opponentGear(o))
            .map((it) => (it ? itemIcon(it, 'xs') : ''))
            .join('');
          return `<button class="opp ${o.id === sel.id ? 'selected' : ''}" data-action="select" data-id="${o.id}" title="${esc(o.description)}">
            <span class="opp-name">${esc(o.name)} ${beaten ? icon('laurel', 'sm') : ''}</span>
            <span class="opp-gear">${gear}</span>
            <span class="lvl">Nv ${o.level}</span>
          </button>`;
        })
        .join('');
      return `<div class="arena-group"><div class="arena-name">${esc(arena.name)}</div>${cards}</div>`;
    }).join('');

    return `
      <div class="card hero-card">
        <div class="row between"><span class="hero-name">${esc(p.name)}</span><span class="lvl big">Nível ${p.level}</span></div>
        <div class="big-stats">
          <span title="Vida máxima">${icon('attr_vit')} ${stats.maxHp}</span>
          <span title="Dano básico">${icon('attr_str')} ${Math.round(stats.baseDamage)}</span>
          <span title="Redução de dano">${icon('attr_res')} ${Math.round(stats.damageReduction * 100)}%</span>
        </div>
        ${p.unspentPoints > 0 ? `<button class="btn btn-gold wide" data-action="goto">+${p.unspentPoints} pontos para usar</button>` : ''}
      </div>
      <div class="fight-box">
        <button class="btn btn-red btn-fight" data-action="fight" ${selUnlocked && !fightErr ? '' : 'disabled'}>LUTAR</button>
        <p class="hint center ${fightErr ? 'red' : ''}">${fightErr ?? `Gasta ${FIGHT_ENERGY} de energia e 2 horas.`}</p>
        <div class="row between fight-info">
          <span>vs <b>${esc(sel.name)}</b> · ${esc(arenaForOpponent(sel.id).name)}</span>
          ${selUnlocked ? `<span class="diff ${diff.cls}" title="Chance estimada de vitória">${diff.label} ${Math.round(chance * 100)}%</span>` : ''}
        </div>
      </div>
      <h3>Estratégia</h3>
      <div class="row strategies">${strategies}</div>
      <p class="hint">${STRAT_HINT[p.strategy]}</p>
      <label class="check"><input type="checkbox" data-action="auto" ${p.settings.autoContinue ? 'checked' : ''}> Revanche automática</label>
      <h3>Adversários</h3>
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
