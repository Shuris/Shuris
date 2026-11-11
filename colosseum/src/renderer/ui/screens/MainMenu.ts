// Tela "Arena": o gladiador, a estratégia, o desafiante do dia, a escada de
// adversários (com retratos), pedidos de revanche e o torneio de sábado.
import type { PlayerState, StrategyId } from '../../core/model/types';
import { OPPONENTS, getOpponent, type OpponentDef } from '../../core/data/opponents';
import { ARENAS, arenaForOpponent } from '../../core/data/arenas';
import { STRATEGIES } from '../../core/data/skills';
import { PERSONALITY } from '../../core/data/dialogue';
import { freeChallenger } from '../../core/data/fighters';
import { isUnlocked } from '../../core/systems/ProgressionSystem';
import { playerCombatStats } from '../../core/systems/AttributeSystem';
import { opponentGear } from '../../core/combat/CombatantFactory';
import { fightDef, ladderCheck, rematchActive } from '../../core/systems/RivalSystem';
import { isFestival } from '../../core/systems/EventSystem';
import {
  TOURNAMENT_START,
  canRegister,
  canStart,
  entryFee,
  isSaturday,
  nextSaturday,
} from '../../core/systems/TournamentSystem';
import { esc, icon, itemIcon } from '../dom';
import { FIGHT_ENERGY, canFight } from '../../core/systems/CalendarSystem';
import type { Screen, ScreenDeps } from './Screen';
import { t, tk } from '../../i18n';
import { arenaName, opponentDesc, opponentEpithet, strategyName } from '../../i18n/data';
import { portrait } from '../components/portraits';
import { duoCard, inviteCards, venatioCard } from '../components/career';
import { isVenatioDay, venatioCheck } from '../../core/systems/VenatioSystem';
import { openInvites } from '../../core/systems/InviteSystem';

export function difficulty(chance: number): { label: string; cls: string } {
  if (chance >= 0.75) return { label: t('diff.easy'), cls: 'diff-easy' };
  if (chance >= 0.5) return { label: t('diff.even'), cls: 'diff-even' };
  if (chance >= 0.25) return { label: t('diff.hard'), cls: 'diff-hard' };
  return { label: t('diff.vhard'), cls: 'diff-vhard' };
}

/** Desafiante avulso da próxima luta do dia (cada luta, um rosto novo). */
export function todaysChallenger(p: PlayerState): OpponentDef {
  const n = p.events.freeDay === p.day ? p.events.freeCount : 0;
  return freeChallenger(p.createdAt, p.day, n, p.level);
}

type ArenaTab = 'fights' | 'events' | 'duo';

export class MainMenu implements Screen {
  private tab: ArenaTab = 'fights';
  readonly id = 'arena' as const;
  get title() {
    return t('arena.title');
  }
  get tip() {
    return t('arena.tip');
  }

  constructor(private readonly d: ScreenDeps) {}

  private chanceTag(def: OpponentDef): string {
    const chance = this.d.actions.winChance(def);
    const diff = difficulty(chance);
    return `<span class="diff ${diff.cls}">${diff.label} ${Math.round(chance * 100)}%</span>`;
  }

  private tournamentCard(p: PlayerState): string {
    const tr = p.tournament;
    const sat = nextSaturday(p.day);
    const hour = Math.floor(TOURNAMENT_START / 60);
    let body: string;
    if (tr.run) {
      body = `<button class="btn btn-gold wide" data-action="tour-bracket">${t('tour.openBracket')}</button>`;
    } else if (tr.registered === sat) {
      const err = isSaturday(p.day) ? canStart(p) : null;
      body = isSaturday(p.day)
        ? `<button class="btn btn-red wide" data-action="tour-start" ${err ? 'disabled' : ''}>${t('tour.start')}</button><p class="tiny ${err ? 'red' : 'dim'} center">${err ?? t('tour.startHint')}</p>`
        : `<p class="tiny gold center">${t('tour.registered', { day: sat, hour })}</p>`;
    } else {
      const err = canRegister(p);
      body = `<button class="btn btn-gold wide" data-action="tour-register" ${err ? 'disabled' : ''}>${t('tour.register')} ${icon('coin', 'xs')} ${entryFee(p)}</button>
        <p class="tiny ${err ? 'red' : 'dim'} center">${err ?? t('tour.registerHint', { day: sat, hour })}</p>`;
    }
    const titles = tr.titles ? ` · ${icon('laurel', 'xs')} ${t('tour.titles', { n: tr.titles })}` : '';
    return `<div class="card tour-card"><div class="row between"><b>${t('tour.title')}</b><span class="tiny dim">${t('tour.when', { hour })}${titles}</span></div>${body}</div>`;
  }

  private challengerCard(p: PlayerState, fightErr: string | null): string {
    const c = todaysChallenger(p);
    return `<div class="card challenger-card">
      ${portrait(c.id, 'md')}
      <div class="ch-info">
        <div class="tiny dim">${t('arena.challenger')}</div>
        <b>${esc(c.name)}</b> <span class="tiny">${esc(opponentEpithet(c))}</span>
        <div class="row between"><span class="lvl">${t('common.lv', { n: c.level })}</span>${this.chanceTag(c)}</div>
      </div>
      <button class="btn btn-red" data-action="fight-free" ${fightErr ? 'disabled' : ''}>${t('arena.fight')}</button>
    </div>`;
  }

  render(p: PlayerState): string {
    const { stats } = playerCombatStats(p);
    const sel = getOpponent(p.selectedOpponent) ?? OPPONENTS[0];
    const selErr = ladderCheck(p, sel.id);
    const selDef = fightDef(p, sel);
    const fightErr = canFight(p);
    const rem = p.rematch && rematchActive(p, p.rematch.opponentId) ? getOpponent(p.rematch.opponentId) : null;
    const strategies = (Object.keys(STRATEGIES) as StrategyId[])
      .map((s) => `<button class="btn strat ${p.strategy === s ? 'active' : ''}" data-action="strategy" data-id="${s}">${esc(strategyName(s))}</button>`)
      .join('');

    const groups = ARENAS.map((arena) => {
      const opps = OPPONENTS.filter((o) => arenaForOpponent(o.id).id === arena.id);
      const cards = opps
        .map((o) => {
          const unlocked = isUnlocked(p, o.id);
          const beaten = p.defeatedOpponents.includes(o.id);
          const rematch = rematchActive(p, o.id);
          if (!unlocked) return `<div class="opp locked">${portrait('locked', 'sm')}<span class="opp-name">???</span><span class="lvl">${t('common.lv', { n: o.level })}</span></div>`;
          const gear = Object.values(opponentGear(o))
            .map((it) => (it ? itemIcon(it, 'xs') : ''))
            .join('');
          const rec = p.rivals[o.id];
          return `<button class="opp ${o.id === sel.id ? 'selected' : ''} ${beaten && !rematch ? 'beaten' : ''} ${rematch ? 'rematch' : ''}" data-action="select" data-id="${o.id}">
            ${portrait(o.id, 'sm')}
            <span class="opp-name">${esc(o.name)} ${beaten ? icon('laurel', 'sm') : ''}${rematch ? ` <span class="tag red">${t('rival.rematchTag')}</span>` : ''}</span>
            <span class="opp-gear">${gear}</span>
            <span class="lvl">${rec ? `<span class="tiny dim">${rec.wins}–${rec.losses}</span> ` : ''}${t('common.lv', { n: o.level })}</span>
          </button>`;
        })
        .join('');
      return `<div class="arena-group"><div class="arena-name">${esc(arenaName(arena))}</div>${cards}</div>`;
    }).join('');

    const rec = p.rivals[sel.id];
    const boost = selDef.level - sel.level;
    const detail = selErr && !isUnlocked(p, sel.id)
      ? ''
      : `<div class="opp-detail">
          ${portrait(sel.id, 'lg')}
          <div>
            <div class="opp-title"><b>${esc(sel.name)}</b>, ${esc(opponentEpithet(sel))}</div>
            <div class="tiny"><span class="tag">${esc(tk(`trait.${PERSONALITY[sel.id] ?? 'proud'}`))}</span> ${rec ? t('rival.record', { w: rec.wins, l: rec.losses }) : t('rival.firstMeet')}</div>
            <p class="tiny dim">${esc(opponentDesc(sel))}</p>
            ${boost > 0 ? `<p class="tiny red">${t('rival.trained', { n: boost })}</p>` : ''}
          </div>
        </div>`;

    const tabBtn = (id: ArenaTab, label: string, badge = '') =>
      `<button class="btn ${this.tab === id ? 'active' : ''}" data-action="tab" data-id="${id}">${label}${badge}</button>`;
    const eventsBadge = isVenatioDay(p.createdAt, p.day) && !venatioCheck(p) ? ' <span class="dot"></span>' : openInvites(p).length ? ' <span class="dot"></span>' : '';
    const banner = `${isFestival(p.day) ? `<div class="festival-banner">${t('event.festivalBanner')}</div>` : ''}${p.injury ? `<div class="injury-note">${t('injury.note', { n: p.injury.days })}</div>` : ''}`;
    const hero = `<div class="card hero-card compact">
        <span class="hero-name">${esc(p.name)}</span><span class="lvl">${t('common.lv', { n: p.level })}</span>
        <span class="big-stats">
          <span>${icon('attr_vit', 'xs')} ${stats.maxHp}</span>
          <span>${icon('attr_str', 'xs')} ${Math.round(stats.baseDamage)}</span>
          <span>${icon('attr_res', 'xs')} ${Math.round(stats.damageReduction * 100)}%</span>
        </span>
        ${p.unspentPoints > 0 ? `<button class="btn btn-gold sm" data-action="goto">+${p.unspentPoints}</button>` : ''}
      </div>`;
    const tabs = `<div class="subtabs arena-tabs">${tabBtn('fights', t('arena.tabFights'))}${tabBtn('events', t('arena.tabEvents'), eventsBadge)}${tabBtn('duo', t('arena.tabDuo'))}</div>`;
    const cost = `<p class="tiny center ${fightErr ? 'red' : 'dim'}">${fightErr ?? t('arena.cost', { energy: FIGHT_ENERGY })}</p>`;
    let content = '';
    if (this.tab === 'fights') {
      content = `
      <div class="row strategies">${strategies}</div>
      ${rem ? `<div class="card rematch-card">${portrait(rem.id, 'md')}<div><b>${t('rival.asked', { name: rem.name })}</b><p class="tiny dim">${t('rival.askedHint', { day: p.rematch!.expires })}</p></div><button class="btn btn-red" data-action="fight-rematch" ${fightErr ? 'disabled' : ''}>${t('rival.accept')}</button></div>` : ''}
      ${this.challengerCard(p, fightErr)}
      <h3>${t('arena.opponents')}</h3>
      ${detail}
      <div class="fight-box">
        <button class="btn btn-red btn-fight" data-action="fight" ${selErr || fightErr ? 'disabled' : ''}>${rematchActive(p, sel.id) ? t('rival.accept') : t('arena.fight')}</button>
        <div class="row between fight-info">
          <span>vs <b>${esc(sel.name)}</b> · ${esc(arenaName(arenaForOpponent(sel.id)))}</span>
          ${selErr ? `<span class="tiny dim">${esc(selErr)}</span>` : this.chanceTag(selDef)}
        </div>
      </div>
      <div class="opp-list">${groups}</div>`;
    } else if (this.tab === 'events') {
      content = `${venatioCard(p, fightErr)}${this.tournamentCard(p)}${inviteCards(p, fightErr)}`;
    } else {
      content = duoCard(p, fightErr);
    }
    return `${banner}${hero}${tabs}${cost}${content}`;
  }

  onAction(action: string, el: HTMLElement): void {
    const id = el.dataset.id ?? '';
    switch (action) {
      case 'tab':
        if (id === 'fights' || id === 'events' || id === 'duo') {
          this.tab = id;
          this.d.actions.rerender();
        }
        break;
      case 'strategy':
        if (id in STRATEGIES) this.d.store.update((p) => (p.strategy = id as StrategyId));
        break;
      case 'select':
        if (getOpponent(id)) this.d.store.update((p) => (p.selectedOpponent = id));
        break;
      case 'fight':
        this.d.actions.startBattle({ mode: 'ladder' });
        break;
      case 'fight-free':
        this.d.actions.startBattle({ mode: 'free' });
        break;
      case 'fight-rematch':
        this.d.actions.startBattle({ mode: 'ladder', opponentId: this.d.store.state.rematch?.opponentId });
        break;
      case 'tour-register':
        this.d.actions.tournament('register');
        break;
      case 'tour-start':
        this.d.actions.tournament('start');
        break;
      case 'tour-bracket':
        this.d.actions.tournament('bracket');
        break;
      case 'goto':
        this.d.actions.open('gladiator');
        break;
    }
  }
}
