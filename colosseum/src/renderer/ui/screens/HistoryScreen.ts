// Histórico das últimas batalhas.
import type { PlayerState } from '../../core/model/types';
import { getItem } from '../../core/data/equipment';
import { STRATEGIES } from '../../core/data/skills';
import { esc, fmtDate, fmtDuration, icon, rarityName } from '../dom';
import type { Screen } from './Screen';

const REASON = { ko: 'nocaute', decision: 'decisão', forfeit: 'desistência' } as const;

export class HistoryScreen implements Screen {
  readonly id = 'history' as const;
  readonly title = 'Histórico';
  readonly tip = 'Aqui ficam registradas as últimas 50 lutas, com o resultado e as recompensas recebidas.';

  render(p: PlayerState): string {
    const winRate = p.stats.battles ? Math.round((p.stats.wins / p.stats.battles) * 100) : 0;
    const rows = p.history
      .map((h) => {
        const item = h.itemId ? getItem(h.itemId) : undefined;
        return `<div class="hist ${h.result}">
          <div class="row between"><b>${h.result === 'win' ? 'Vitória' : 'Derrota'}</b><span class="dim">${fmtDate(h.date)}</span></div>
          <div>vs ${esc(h.opponentName)} (Nv ${h.opponentLevel}) · ${REASON[h.reason]} · ${fmtDuration(h.duration)} · ${esc(STRATEGIES[h.strategy].name)}</div>
          <div class="rewards">+${h.xp} XP · ${icon('coin', 'xs')} +${h.coins}${h.reputation ? ` · ${icon('laurel', 'xs')} +${h.reputation}` : ''}${item ? ` · ${rarityName(item)}` : ''}${h.levelUps ? ` · <span class="gold">subiu de nível!</span>` : ''}</div>
        </div>`;
      })
      .join('');
    return `<div class="card row stats-line"><span>Lutas <b>${p.stats.battles}</b></span><span>Vitórias <b>${p.stats.wins}</b></span><span>Derrotas <b>${p.stats.losses}</b></span><span>Aproveitamento <b>${winRate}%</b></span></div>
      <div class="history">${rows || '<p class="dim">Nenhuma luta registrada ainda. Vá até a Arena!</p>'}</div>`;
  }

  onAction(): void {
    /* somente leitura */
  }
}
