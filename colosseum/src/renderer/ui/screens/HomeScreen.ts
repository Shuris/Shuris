// Alojamento: dormir até o dia seguinte ou cochilar. A cama comprada no mercado
// melhora o cochilo.
import type { PlayerState } from '../../core/model/types';
import { NAP_MINUTES, canNap, napEnergy } from '../../core/systems/CalendarSystem';
import { bar } from '../dom';
import { t } from '../../i18n';
import { hasUpgrade } from '../../core/data/upgrades';
import type { Screen, ScreenDeps } from './Screen';

export class HomeScreen implements Screen {
  readonly id = 'home' as const;
  get title() {
    return t('home.title');
  }
  get tip() {
    return t('home.tip');
  }

  constructor(private readonly d: ScreenDeps) {}

  render(p: PlayerState): string {
    const napErr = canNap(p);
    const bed = hasUpgrade(p, 'bed_noble') ? t('home.bedNoble') : hasUpgrade(p, 'bed_wool') ? t('home.bedWool') : t('home.bedStraw');
    return `<div class="card center">
        <div class="big-num">${t('common.dayN', { n: p.day })}</div>
        <div class="hint">${t('common.energy')}</div>
        ${bar(p.energy, 100, 'energy')}
      </div>
      <button class="btn btn-gold btn-big wide" data-action="sleep">${t('home.sleep')}</button>
      <p class="hint center">${t('home.sleepHint')}</p>
      <button class="btn wide" data-action="nap" ${napErr ? `disabled` : ''}>${t('home.nap', { hours: NAP_MINUTES / 60, energy: napEnergy(p) })}</button>
      <p class="tiny dim center">${t('home.bed', { bed })}</p>`;
  }

  onAction(action: string): void {
    if (action === 'sleep') this.d.actions.sleep();
    if (action === 'nap') this.d.actions.nap();
  }
}
