// Janela da chave do torneio de sábado: quartas, semifinais, final e campeão.
import type { PlayerState, TournamentRun } from '../../core/model/types';
import { getPoolFighter } from '../../core/data/fighters';
import { currentRound, playerMatch, playerSlot, prize, reachedRound, roundPairs } from '../../core/systems/TournamentSystem';
import { esc, icon } from '../dom';
import { t, tk } from '../../i18n';
import { portrait } from '../components/portraits';

function nameAt(p: PlayerState, run: TournamentRun, slot: number | undefined): string {
  if (slot === undefined) return '';
  const id = run.bracket[slot];
  return id === 'player' ? p.name : (getPoolFighter(id)?.name ?? id);
}

function clsAt(run: TournamentRun, slot: number): string {
  const f = getPoolFighter(run.bracket[slot]);
  return f ? tk(`class.${f.cls}.ep`) : '';
}

function fighter(p: PlayerState, run: TournamentRun, slot: number | undefined, winner: number | undefined, playerPic: string): string {
  if (slot === undefined) return `<div class="bk-f empty">—</div>`;
  const me = run.bracket[slot] === 'player';
  const lost = winner !== undefined && winner !== slot;
  const won = winner === slot;
  const pic = me ? portrait('player', 'xs', playerPic) : portrait(run.bracket[slot], 'xs');
  return `<div class="bk-f ${me ? 'me' : ''} ${lost ? 'lost' : ''} ${won ? 'won' : ''}">${pic}<span class="bk-name">${esc(nameAt(p, run, slot))}</span><span class="bk-lv">${t('common.lv', { n: run.levels[slot] })}</span></div>`;
}

/** HTML da chave. `playerPic` é o retrato montado do jogador (data URL). */
export function bracketHtml(p: PlayerState, run: TournamentRun, playerPic: string): string {
  const cols: string[] = [];
  for (let r = 0; r < 3; r++) {
    const pairs = r <= currentRound(run) ? roundPairs(run, r) : [];
    const start = r === 0 ? 0 : r === 1 ? 4 : 6;
    const count = r === 0 ? 4 : r === 1 ? 2 : 1;
    const matches: string[] = [];
    for (let i = 0; i < count; i++) {
      const pair = pairs[i];
      const w = run.winners[start + i];
      matches.push(`<div class="bk-match">${fighter(p, run, pair?.[0], w, playerPic)}${fighter(p, run, pair?.[1], w, playerPic)}</div>`);
    }
    cols.push(`<div class="bk-col"><div class="bk-round">${t(`tour.round${r}` as 'tour.round0')}</div>${matches.join('')}</div>`);
  }
  const champ = run.winners[6];
  cols.push(`<div class="bk-col bk-champ"><div class="bk-round">${t('tour.champion')}</div>${champ !== undefined ? `<div class="bk-match">${fighter(p, run, champ, champ, playerPic)}</div>` : `<div class="bk-match"><div class="bk-f empty">${icon('laurel')}</div></div>`}</div>`);

  const match = playerMatch(run);
  let footer: string;
  if (match) {
    footer = `<p class="center">${t('tour.next', { round: t(`tour.round${match.round}` as 'tour.round0'), name: esc(match.opponent.name), cls: esc(clsAt(run, match.opponentSlot)) })}</p>
      <div class="row center"><button class="btn" data-t="close">${t('tour.later')}</button><button class="btn btn-red" data-t="fight">${t('arena.fight')}</button></div>`;
  } else {
    const reached = reachedRound(run);
    const pr = prize(p.level, reached);
    footer = `<p class="center ${reached === 3 ? 'gold' : ''}">${t(`tour.result${reached}` as 'tour.result0')}</p>
      <div class="rewards-box">${pr.coins ? `<div class="reward">${icon('coin')} <b>+${pr.coins}</b></div>` : ''}<div class="reward">${icon('laurel')} <b>+${pr.fame}</b></div><div class="reward">${icon('xp')} <b>+${pr.xp}</b> XP</div></div>
      <div class="row center"><button class="btn btn-gold" data-t="claim">${t('tour.claim')}</button></div>`;
  }
  const me = playerSlot(run);
  return `<h2 class="center">${t('tour.title')} · ${t('common.dayN', { n: run.day })}</h2>
    <div class="bracket" data-me="${me}">${cols.join('')}</div>
    ${footer}`;
}
