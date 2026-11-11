// Cartões da carreira (versão 0.9): convites das arenas
// particulares, venatio (feras), duplas com amigos e o ranking da cidade.
// As ações (data-action="career-...") são tratadas pela App, em qualquer tela.
import type { LocationId, PlayerState } from '../../core/model/types';
import { RESPECT_CHAT, isHater, rivalsAt } from '../../core/systems/RivalTownSystem';
import { getOpponent } from '../../core/data/opponents';
import { getPoolFighter } from '../../core/data/fighters';
import { getArena } from '../../core/data/arenas';
import { INVITES, getInviteDef, inviteFoe, openInvites } from '../../core/systems/InviteSystem';
import { beastOfDay, isVenatioDay, nextVenatioDay, venatioCheck, BEAST_FAME_MUL } from '../../core/systems/VenatioSystem';
import { FRIEND_RESPECT, DUO_ENERGY, duoCheck, duoFoes, friends, partnerDef, respectOf } from '../../core/systems/DuoSystem';
import { rankTable } from '../../core/systems/RankingSystem';
import { esc, icon } from '../dom';
import { portrait } from './portraits';
import { t, tk } from '../../i18n';
import { arenaName, opponentEpithet } from '../../i18n/data';

/** Convites abertos das arenas particulares. */
export function inviteCards(p: PlayerState, fightErr: string | null): string {
  const open = openInvites(p);
  const next = INVITES.find((d) => !p.career.invites.some((i) => i.id === d.id));
  const cards = open
    .map((inv) => {
      const def = getInviteDef(inv.id);
      const foe = inviteFoe(inv);
      const arena = getArena(inv.id);
      if (!def || !foe || !arena) return '';
      const stage = def.kind === 'tournament' ? ` <span class="tag gold">${inv.round === 0 ? t('invite.semi') : t('invite.final')}</span>` : '';
      return `<div class="card invite-card invite-${inv.id}">
        <div class="row between"><b>${esc(tk(`invite.${inv.id}.title`))}</b>${stage}</div>
        <p class="tiny dim">${esc(tk(`invite.${inv.id}.desc`))}</p>
        <div class="row">${portrait(foe.id, 'sm')}<div class="tiny">vs <b>${esc(foe.name)}</b>, ${esc(opponentEpithet(foe))} · ${t('common.lv', { n: foe.level })}<br>${esc(arenaName(arena))}</div></div>
        <button class="btn btn-red wide" data-action="career-invite" data-id="${inv.id}" ${fightErr ? 'disabled' : ''}>${t('invite.go')}</button>
      </div>`;
    })
    .join('');
  const hint = next ? `<p class="tiny dim center">${t('invite.next', { n: next.fame })}</p>` : '';
  return cards || hint ? `<h3>${t('invite.title')}</h3>${cards}${hint}` : '';
}

/** Venatio: luta contra a fera do dia (só em alguns dias). */
export function venatioCard(p: PlayerState, fightErr: string | null): string {
  if (!isVenatioDay(p.createdAt, p.day)) {
    const next = nextVenatioDay(p.createdAt, p.day + 1);
    return next ? `<p class="tiny dim center">${t('venatio.next', { day: next })}</p>` : '';
  }
  const beast = beastOfDay(p);
  const err = venatioCheck(p);
  return `<div class="card venatio-card">
    ${portrait(beast.id, 'md')}
    <div class="ch-info">
      <div class="tiny gold">${t('venatio.today')}</div>
      <b>${esc(tk(`beast.${beast.beast}.name`))}</b> <span class="tiny">${esc(opponentEpithet(beast))}</span>
      <div class="row between"><span class="lvl">${t('common.lv', { n: beast.level })}</span><span class="tag gold">${t('venatio.fame', { n: BEAST_FAME_MUL })}</span></div>
    </div>
    <button class="btn btn-red" data-action="career-beast" ${err || fightErr ? 'disabled' : ''}>${err === 'done' ? t('venatio.done') : t('venatio.fight')}</button>
  </div>`;
}

/** Duplas: amigos (respeito), parceiro escolhido e a dupla adversária do dia. */
export function duoCard(p: PlayerState, fightErr: string | null): string {
  const fr = friends(p);
  const known = Object.keys(p.career.respect).filter((id) => respectOf(p, id) < FRIEND_RESPECT && getOpponent(id));
  if (!fr.length && !known.length) return `<h3>${t('duo.title')}</h3><p class="tiny dim">${t('duo.howTo', { n: FRIEND_RESPECT })}</p>`;
  const partner = partnerDef(p);
  const list = [...fr.map((o) => o.id), ...known]
    .map((id) => {
      const o = getOpponent(id)!;
      const r = respectOf(p, id);
      const friend = r >= FRIEND_RESPECT;
      const chosen = partner?.id === id;
      return `<div class="friend-row ${chosen ? 'chosen' : ''}">${portrait(id, 'xs')}<span class="tiny"><b>${esc(o.name)}</b> ${friend ? `<span class="tag gold">${t('duo.friend')}</span>` : ''}</span>
        <span class="respect"><span style="width:${r}%"></span></span>
        ${friend ? `<button class="btn sm ${chosen ? 'btn-gold' : ''}" data-action="career-partner" data-id="${id}">${chosen ? t('duo.partner') : t('duo.choose')}</button>` : `<span class="tiny dim">${r}/${FRIEND_RESPECT}</span>`}</div>`;
    })
    .join('');
  const err = duoCheck(p);
  const [f1, f2] = duoFoes(p);
  const foes = `<div class="row duo-foes tiny">vs ${portrait(f1.id, 'xs')} <b>${esc(f1.name)}</b> & ${portrait(f2.id, 'xs')} <b>${esc(f2.name)}</b> · ${t('common.lv', { n: f1.level })}</div>`;
  return `<h3>${t('duo.title')}</h3>
    <div class="card duo-card">
      <p class="tiny dim">${t('duo.rules')}</p>
      <div class="friends">${list}</div>
      ${partner ? foes : ''}
      <button class="btn btn-red wide" data-action="career-duo" ${err || fightErr ? 'disabled' : ''}>${err === 'noPartner' ? t('duo.needPartner') : err === 'done' ? t('duo.done') : t('duo.fight', { n: DUO_ENERGY })}</button>
    </div>`;
}

/** Tabela do ranking (fórum): os 10 primeiros e a linha do jogador se estiver fora. */
export function rankingHtml(p: PlayerState): string {
  const rows = rankTable(p);
  const me = rows.find((r) => r.player)!;
  const show = rows.slice(0, 10);
  if (me.pos > 10) show.push(me);
  const arrow = (pos: number, prev: number) => {
    if (!prev) return '<span class="rk-new">•</span>';
    if (prev > pos) return `<span class="rk-up">▲${prev - pos}</span>`;
    if (prev < pos) return `<span class="rk-down">▼${pos - prev}</span>`;
    return '<span class="rk-same">–</span>';
  };
  const name = (id: string) => getOpponent(id)?.name ?? getPoolFighter(id)?.name ?? id;
  const body = show
    .map((r) => `<tr class="${r.player ? 'me' : ''}${r.pos > 10 ? ' out' : ''}"><td>${r.pos}</td><td>${arrow(r.pos, r.prev)}</td><td>${r.player ? icon('laurel', 'sm') : portrait(r.id, 'xs')}</td><td>${esc(r.player ? p.name : name(r.id))}</td><td>${t('common.lv', { n: r.level })}</td><td>${r.w}–${r.l}</td><td><b>${r.pts}</b></td></tr>`)
    .join('');
  return `<div class="card ranking">
    <div class="row between"><b>${t('rank.title')}</b><span class="tiny dim">${t('rank.you', { n: me.pos })}</span></div>
    <table class="rank-table"><thead><tr><th>#</th><th></th><th></th><th>${t('rank.name')}</th><th>${t('rank.level')}</th><th>${t('rank.record')}</th><th>${t('rank.points')}</th></tr></thead><tbody>${body}</tbody></table>
    <p class="tiny dim">${t('rank.hint')}</p>
  </div>`;
}


/** Rivais derrotados que estão neste local: conversar (uma vez por dia) ou o desprezo de quem odeia você. */
export function rivalsCard(p: PlayerState, loc: LocationId, open: boolean): string {
  const list = open ? rivalsAt(p, loc) : [];
  if (!list.length) return '';
  const done = p.career.talkDay === p.day;
  const rows = list
    .map((o) => {
      const hate = isHater(o.id);
      const r = respectOf(p, o.id);
      const friend = !hate && r >= FRIEND_RESPECT;
      const state = hate ? `<span class="tag red">${t('rivals.hates')}</span>` : friend ? `<span class="tag gold">${t('duo.friend')}</span>` : `<span class="dim">${r}/${FRIEND_RESPECT}</span>`;
      return `<div class="drink-row">${portrait(o.id, 'xs')}<span class="tiny"><b>${esc(o.name)}</b> ${state}</span><button class="btn sm" data-action="career-chat" data-id="${o.id}" ${done ? 'disabled' : ''}>${hate ? t('rivals.face') : t('rivals.talk')}</button></div>`;
    })
    .join('');
  return `<div class="card rivals-card"><b>${t('rivals.title')}</b><p class="tiny dim">${done ? t('rivals.done') : t('rivals.desc', { n: RESPECT_CHAT })}</p>${rows}</div>`;
}
