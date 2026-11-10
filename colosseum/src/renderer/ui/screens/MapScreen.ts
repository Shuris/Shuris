// Painel do mapa: lista dos locais (também clicáveis no mapa).
import type { LocationId, PlayerState } from '../../core/model/types';
import { LOCATIONS, hoursLabel, isOpen } from '../../core/data/locations';
import { TRAVEL_MINUTES } from '../../core/systems/CalendarSystem';
import { esc } from '../dom';
import { t } from '../../i18n';
import { locationName, locationShort } from '../../i18n/data';
import type { Screen, ScreenDeps } from './Screen';

export class MapScreen implements Screen {
  readonly id = 'map' as const;
  get title() {
    return t('map.title');
  }
  get tip() {
    return t('map.tip');
  }

  constructor(private readonly d: ScreenDeps) {}

  render(p: PlayerState): string {
    return `<div class="places">${LOCATIONS.map((l) => {
      const here = l.id === p.location;
      const open = isOpen(l, p.minutes, p.day);
      return `<button class="place ${here ? 'here' : ''} ${open ? '' : 'closed'}" data-action="go" data-id="${l.id}">
        <b>${esc(locationName(l.id))}</b><span>${esc(locationShort(l.id))}</span><small>${here ? t('map.here') : open ? t('map.minutes', { n: TRAVEL_MINUTES }) : t('map.closed', { hours: hoursLabel(l, p.day) })}</small></button>`;
    }).join('')}</div>`;
  }

  onAction(action: string, el: HTMLElement): void {
    if (action === 'go') this.d.actions.travel(el.dataset.id as LocationId);
  }
}
