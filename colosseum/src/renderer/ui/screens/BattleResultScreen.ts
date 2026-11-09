// Resultado da batalha: recompensas, evolução de nível e próximos passos.
import type { CombatResult } from '../../core/combat/CombatTypes';
import type { OpponentDef } from '../../core/data/opponents';
import { getItem, RARITY_LABEL } from '../../core/data/equipment';
import type { BattleRewards } from '../../core/systems/ProgressionSystem';
import { esc, fmtDuration, icon, itemIcon, rarityName } from '../dom';

const REASON = { ko: 'por nocaute', decision: 'por decisão (tempo esgotado)', forfeit: 'por desistência' } as const;

export function resultHtml(res: CombatResult, rw: BattleRewards, opp: OpponentDef, auto: boolean, compact: boolean): string {
  const won = rw.result === 'win';
  const item = rw.itemId ? getItem(rw.itemId) : undefined;
  const [me, them] = res.fighters;
  const lines = `
    <div class="reward">${icon('xp')} Experiência <b>+${rw.xp}</b></div>
    <div class="reward">${icon('coin')} Moedas <b>+${rw.coins}</b></div>
    ${rw.reputation ? `<div class="reward">${icon('laurel')} Reputação <b>+${rw.reputation}</b></div>` : ''}
    ${item ? `<div class="reward item-reward">${itemIcon(item)} <span>Equipamento recebido: ${rarityName(item)} <span class="tag">${RARITY_LABEL[item.rarity]}</span></span></div>` : ''}`;
  if (compact) {
    return `<div class="result-compact ${won ? 'win' : 'loss'}">
      <h2>${won ? 'Vitória!' : 'Derrota'}</h2>
      <div class="small">+${rw.xp} XP · ${icon('coin', 'xs')} +${rw.coins}${item ? ` · ${rarityName(item)}` : ''}${rw.levelUps ? ' · <b class="gold">Nível ' + rw.newLevel + '!</b>' : ''}</div>
      ${auto ? '<div class="tiny" data-countdown>Próxima luta em instantes…</div>' : ''}
      <div class="row center"><button class="btn sm" data-r="close">OK</button><button class="btn sm btn-red" data-r="again">Revanche</button></div>
    </div>`;
  }
  return `
    <div class="result ${won ? 'win' : 'loss'}">
      <h1>${won ? 'VITÓRIA!' : 'DERROTA'}</h1>
      <p class="subtitle">${won ? 'Venceu' : 'Perdeu para'} ${esc(opp.name)}, ${esc(opp.epithet)} ${REASON[res.reason]} em ${fmtDuration(res.duration)}.</p>
      <div class="result-stats small">
        <span>Seus acertos: <b>${me.counters.hits}</b>/${me.counters.attacks}</span>
        <span>Dano causado: <b>${me.counters.damageDealt}</b></span>
        <span>Dano recebido: <b>${them.counters.damageDealt}</b></span>
        <span>Habilidades: <b>${me.counters.skillsUsed}</b></span>
      </div>
      <div class="rewards-box">${lines}</div>
      ${rw.levelUps ? `<div class="levelup">${icon('laurel')} Subiu para o <b>nível ${rw.newLevel}</b>! +${rw.pointsGained} pontos de atributo para distribuir.</div>` : ''}
      ${rw.unlockedOpponent ? `<div class="unlock">Novo adversário desbloqueado: <b>${esc(rw.unlockedOpponent.name)}, ${esc(rw.unlockedOpponent.epithet)}</b> (Nv ${rw.unlockedOpponent.level}).</div>` : ''}
      ${won ? '' : '<p class="hint">Derrotas não tiram níveis nem equipamentos. Treine, ajuste atributos, troque equipamentos ou a estratégia e tente novamente.</p>'}
      ${auto ? '<p class="tiny" data-countdown></p>' : ''}
      <div class="row center">
        ${rw.levelUps ? '<button class="btn btn-gold" data-r="points">Distribuir pontos</button>' : ''}
        <button class="btn" data-r="close">Continuar</button>
        <button class="btn btn-red" data-r="again">Lutar novamente</button>
      </div>
    </div>`;
}
