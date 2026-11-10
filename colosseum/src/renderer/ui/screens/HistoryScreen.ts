// Histórico das últimas batalhas — uma linha por luta.
import type { PlayerState } from '../../core/model/types';
import { getItem } from '../../core/data/equipment';
import { esc, fmtDuration, icon, rarityName } from '../dom';
import type { Screen } from './Screen';

export class HistoryScreen implements Screen {
  readonly id = 'history' as const;
  readonly title = 'Histórico';
  readonly tip = 'Suas últimas lutas e recompensas.';

  render(p: PlayerState): string {
    const winRate = p.stats.battles ? Math.round((p.stats.wins / p.stats.battles) * 100) : 0;
    const rows = p.history
      .map((h) => {
        const item = h.itemId ? getItem(h.itemId) : undefined;
        return `<div class="hist ${h.result}">
          <div class="row between"><b>${h.result === 'win' ? 'Vitória' : 'Derrota'} · ${esc(h.opponentName.split(',')[0])}</b><span class="dim">${fmtDuration(h.duration)}</span></div>
          <div class="rewards">+${h.xp} XP · ${icon('coin', 'xs')} ${h.coins}${item ? ` · ${rarityName(item)}` : ''}${h.levelUps ? ' · <span class="gold">subiu de nível</span>' : ''}</div>
        </div>`;
      })
      .join('');
    return `<div class="big-stats card"><span>${p.stats.wins} <small>vitórias</small></span><span>${p.stats.losses} <small>derrotas</small></span><span>${winRate}%</span></div>
      <div class="history">${rows || '<p class="dim">Nenhuma luta ainda.</p>'}</div>`;
  }

  onAction(): void {
    /* somente leitura */
  }
}
