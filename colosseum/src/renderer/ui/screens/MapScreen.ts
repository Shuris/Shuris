// Painel do mapa: lista dos locais (também clicáveis no mapa).
import type { LocationId, PlayerState } from '../../core/model/types';
import { LOCATIONS, hoursLabel, isOpen } from '../../core/data/locations';
import { TRAVEL_MINUTES } from '../../core/systems/CalendarSystem';
import { esc } from '../dom';
import type { Screen, ScreenDeps } from './Screen';

export class MapScreen implements Screen {
  readonly id = 'map' as const;
  readonly title = 'Mapa de Cápua';
  readonly tip = 'Clique num local para ir até ele. Cada viagem leva 20 minutos.';

  constructor(private readonly d: ScreenDeps) {}

  render(p: PlayerState): string {
    return `<div class="places">${LOCATIONS.map((l) => {
      const here = l.id === p.location;
      const open = isOpen(l, p.minutes, p.day);
      return `<button class="place ${here ? 'here' : ''} ${open ? '' : 'closed'}" data-action="go" data-id="${l.id}">
        <b>${esc(l.name)}</b><span>${esc(l.short)}</span><small>${here ? 'você está aqui' : open ? `${TRAVEL_MINUTES} min` : `fechado (${hoursLabel(l, p.day)})`}</small></button>`;
    }).join('')}</div>`;
  }

  onAction(action: string, el: HTMLElement): void {
    if (action === 'go') this.d.actions.travel(el.dataset.id as LocationId);
  }
}
