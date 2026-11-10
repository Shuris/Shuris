// Histórico das últimas batalhas — uma linha por luta.
import type { PlayerState } from '../../core/model/types';
import { getItem } from '../../core/data/equipment';
import { getOpponent } from '../../core/data/opponents';
import { esc, fmtDuration, icon, rarityName } from '../dom';
import { t } from '../../i18n';
import type { Screen } from './Screen';

export class HistoryScreen implements Screen {
  readonly id = 'history' as const;
  get title() {
    return t('hist.title');
  }
  get tip() {
    return t('hist.tip');
  }

  render(p: PlayerState): string {
    const winRate = p.stats.battles ? Math.round((p.stats.wins / p.stats.battles) * 100) : 0;
    const rows = p.history
      .map((h) => {
        const item = h.itemId ? getItem(h.itemId) : undefined;
        const name = getOpponent(h.opponentId)?.name ?? h.opponentName.split(',')[0];
        return `<div class="hist ${h.result}">
          <div class="row between"><b>${h.result === 'win' ? t('common.victory') : t('common.defeat')} · ${esc(name)}</b><span class="dim">${fmtDuration(h.duration)}</span></div>
          <div class="rewards">+${h.xp} XP · ${icon('coin', 'xs')} ${h.coins}${item ? ` · ${rarityName(item)}` : ''}${h.levelUps ? ` · <span class="gold">${t('hist.levelUp')}</span>` : ''}</div>
        </div>`;
      })
      .join('');
    return `<div class="big-stats card"><span>${p.stats.wins} <small>${t('hist.wins')}</small></span><span>${p.stats.losses} <small>${t('hist.losses')}</small></span><span>${winRate}%</span></div>
      <div class="history">${rows || `<p class="dim">${t('hist.none')}</p>`}</div>`;
  }

  onAction(): void {
    /* somente leitura */
  }
}
