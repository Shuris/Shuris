// Termas: pagar para recuperar energia durante o dia.
import type { PlayerState } from '../../core/model/types';
import { BATHS_ENERGY, BATHS_MINUTES, bathsCost, canBathe } from '../../core/systems/CalendarSystem';
import { bar, icon } from '../dom';
import type { Screen, ScreenDeps } from './Screen';

export class BathsScreen implements Screen {
  readonly id = 'baths' as const;
  readonly title = 'Termas';
  readonly tip = 'Um banho quente recupera energia, mas custa moedas.';

  constructor(private readonly d: ScreenDeps) {}

  render(p: PlayerState): string {
    const err = canBathe(p);
    return `<div class="card center"><div class="hint">Energia</div>${bar(p.energy, 100, 'energy')}</div>
      <button class="btn btn-gold btn-big wide" data-action="bathe" ${err ? 'disabled' : ''}>Banho ${icon('coin', 'xs')} ${bathsCost(p)}</button>
      <p class="hint center">${err ?? `+${BATHS_ENERGY} energia · ${BATHS_MINUTES / 60}h`}</p>`;
  }

  onAction(action: string): void {
    if (action === 'bathe') this.d.actions.bathe();
  }
}
