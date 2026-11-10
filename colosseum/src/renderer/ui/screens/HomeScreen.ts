// Alojamento: dormir até o dia seguinte ou cochilar.
import type { PlayerState } from '../../core/model/types';
import { NAP_ENERGY, NAP_MINUTES, canNap } from '../../core/systems/CalendarSystem';
import { bar } from '../dom';
import type { Screen, ScreenDeps } from './Screen';

export class HomeScreen implements Screen {
  readonly id = 'home' as const;
  readonly title = 'Alojamento';
  readonly tip = 'Durma para começar um novo dia com energia cheia.';

  constructor(private readonly d: ScreenDeps) {}

  render(p: PlayerState): string {
    const napErr = canNap(p);
    return `<div class="card center">
        <div class="big-num">Dia ${p.day}</div>
        <div class="hint">Energia</div>
        ${bar(p.energy, 100, 'energy')}
      </div>
      <button class="btn btn-gold btn-big wide" data-action="sleep">Dormir até amanhã</button>
      <p class="hint center">Acorda às 7h com energia cheia. Sai o jornal do dia.</p>
      <button class="btn wide" data-action="nap" ${napErr ? `disabled title="${napErr}"` : ''}>Cochilar ${NAP_MINUTES / 60}h (+${NAP_ENERGY} energia)</button>`;
  }

  onAction(action: string): void {
    if (action === 'sleep') this.d.actions.sleep();
    if (action === 'nap') this.d.actions.nap();
  }
}
