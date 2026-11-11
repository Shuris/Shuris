// Resultado da batalha: grande, direto e com as recompensas em destaque.
import type { CombatResult } from '../../core/combat/CombatTypes';
import type { OpponentDef } from '../../core/data/opponents';
import { getItem } from '../../core/data/equipment';
import type { BattleRewards } from '../../core/systems/ProgressionSystem';
import { esc, fmtDuration, icon, itemIcon, rarityName } from '../dom';
import { t } from '../../i18n';
import { opponentFullName } from '../../i18n/data';


export function resultHtml(
  res: CombatResult,
  rw: BattleRewards,
  opp: OpponentDef,
  again: 'free' | 'retry' | 'final' | null,
  energy: number,
  notes: Array<{ text: string; bad?: boolean }> = [],
  title?: string,
): string {
  const won = rw.result === 'win';
  const item = rw.itemId ? getItem(rw.itemId) : undefined;
  return `
    <div class="result ${won ? 'win' : 'loss'}">
      <h1>${won ? t('result.victory') : t('result.defeat')}</h1>
      ${title ? `<p class="tiny gold center">${esc(title)}</p>` : ''}
      <p class="subtitle">vs ${esc(opponentFullName(opp).split(',')[0])} · ${t(`reason.${res.reason}` as 'reason.ko')} · ${fmtDuration(res.duration)}</p>
      <div class="rewards-box">
        <div class="reward">${icon('xp')} <b>+${rw.xp}</b> XP</div>
        <div class="reward">${icon('coin')} <b>+${rw.coins}</b> ${t('common.coinsLower')}</div>
        ${rw.reputation ? `<div class="reward${rw.reputation < 0 ? ' loss' : ''}">${icon('laurel')} <b>${rw.reputation > 0 ? '+' : ''}${rw.reputation}</b> ${t('common.fameLower')}</div>` : ''}
        ${item ? `<div class="reward">${itemIcon(item)} ${rarityName(item)}</div>` : ''}
      </div>
      ${rw.levelUps ? `<div class="levelup">${t('app.levelUp', { level: rw.newLevel, points: rw.pointsGained, skill: rw.levelUps })}</div>` : ''}
      ${rw.unlockedOpponent ? `<div class="unlock">${t('result.newRival')} <b>${esc(rw.unlockedOpponent.name)}</b></div>` : ''}
      ${rw.festival && rw.reputation > 0 ? `<div class="unlock festival">${t('result.festival')}</div>` : ''}
      ${rw.mode === 'rematch' && won ? `<div class="unlock">${t('result.rematchWon')}</div>` : ''}
      ${rw.rematchAsked ? `<div class="unlock red">${t('result.rematchAsked', { name: esc(opp.name) })}</div>` : ''}
      ${rw.injuryDays ? `<div class="injury-note">${t('injury.got', { n: rw.injuryDays })}</div>` : ''}
      ${notes.map((n) => `<div class="note ${n.bad ? 'bad' : ''}">${n.text}</div>`).join('')}
      ${won || rw.injuryDays || rw.mode === 'invite' || rw.mode === 'duo' || notes.some((n) => n.text === t('result.spared')) ? '' : `<p class="hint">${t('result.noLoss')}</p>`}
      <p class="hint">${t('result.energyLeft', { n: Math.round(energy) })}${energy < 35 ? t('result.rest') : ''}</p>
      <div class="row center">
        ${rw.levelUps ? `<button class="btn btn-gold" data-r="points">${t('result.usePoints')}</button>` : ''}
        <button class="btn" data-r="close">${t('common.continue')}</button>
        ${again ? `<button class="btn btn-red" data-r="again">${again === 'free' ? t('result.nextChallenger') : again === 'final' ? t('invite.fightFinal') : t('result.retry')}</button>` : ''}
      </div>
    </div>`;
}
