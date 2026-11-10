// Termas: pagar para recuperar energia durante o dia.
import type { PlayerState } from '../../core/model/types';
import { BATHS_ENERGY, BATHS_MINUTES, bathsCost, canBathe } from '../../core/systems/CalendarSystem';
import { bar, icon } from '../dom';
import { t } from '../../i18n';
import type { Screen, ScreenDeps } from './Screen';

export class BathsScreen implements Screen {
  readonly id = 'baths' as const;
  get title() {
    return t('baths.title');
  }
  get tip() {
    return t('baths.tip');
  }

  constructor(private readonly d: ScreenDeps) {}

  render(p: PlayerState): string {
    const err = canBathe(p);
    return `<div class="card center"><div class="hint">${t('common.energy')}</div>${bar(p.energy, 100, 'energy')}</div>
      <button class="btn btn-gold btn-big wide" data-action="bathe" ${err ? 'disabled' : ''}>${t('baths.bath')} ${icon('coin', 'xs')} ${bathsCost(p)}</button>
      <p class="hint center">${err ?? t('baths.gain', { energy: BATHS_ENERGY, hours: BATHS_MINUTES / 60 })}</p>`;
  }

  onAction(action: string): void {
    if (action === 'bathe') this.d.actions.bathe();
  }
}
