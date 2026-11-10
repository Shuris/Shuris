// Resultado da batalha: grande, direto e com as recompensas em destaque.
import type { CombatResult } from '../../core/combat/CombatTypes';
import type { OpponentDef } from '../../core/data/opponents';
import { getItem } from '../../core/data/equipment';
import type { BattleRewards } from '../../core/systems/ProgressionSystem';
import { esc, fmtDuration, icon, itemIcon, rarityName } from '../dom';

const REASON = { ko: 'nocaute', decision: 'decisão', forfeit: 'desistência' } as const;

export function resultHtml(res: CombatResult, rw: BattleRewards, opp: OpponentDef, auto: boolean, energy: number): string {
  const won = rw.result === 'win';
  const item = rw.itemId ? getItem(rw.itemId) : undefined;
  return `
    <div class="result ${won ? 'win' : 'loss'}">
      <h1>${won ? 'VITÓRIA!' : 'DERROTA'}</h1>
      <p class="subtitle">vs ${esc(opp.name)} · ${REASON[res.reason]} · ${fmtDuration(res.duration)}</p>
      <div class="rewards-box">
        <div class="reward">${icon('xp')} <b>+${rw.xp}</b> XP</div>
        <div class="reward">${icon('coin')} <b>+${rw.coins}</b> moedas</div>
        ${rw.reputation ? `<div class="reward">${icon('laurel')} <b>+${rw.reputation}</b> fama</div>` : ''}
        ${item ? `<div class="reward">${itemIcon(item)} ${rarityName(item)}</div>` : ''}
      </div>
      ${rw.levelUps ? `<div class="levelup">Nível ${rw.newLevel}! +${rw.pointsGained} pontos e +${rw.levelUps} p/ o Templo</div>` : ''}
      ${rw.unlockedOpponent ? `<div class="unlock">Novo rival: <b>${esc(rw.unlockedOpponent.name)}</b></div>` : ''}
      ${won ? '' : '<p class="hint">Você não perde nada. Treine e tente de novo!</p>'}
      <p class="hint">Energia restante: <b>${Math.round(energy)}</b>${energy < 35 ? ' — hora de descansar.' : ''}</p>
      ${auto ? '<p class="tiny" data-countdown></p>' : ''}
      <div class="row center">
        ${rw.levelUps ? '<button class="btn btn-gold" data-r="points">Usar pontos</button>' : ''}
        <button class="btn" data-r="close">Continuar</button>
        <button class="btn btn-red" data-r="again">Revanche</button>
      </div>
    </div>`;
}
