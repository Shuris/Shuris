// Ludus: treinar custa apenas energia e tempo (sem moedas).
import type { PlayerState, TrainingId } from '../../core/model/types';
import { ATTRIBUTE_INFO } from '../../core/data/gladiators';
import { TRAININGS, TRAINING_THRESHOLD, sessionsToNext } from '../../core/systems/TrainingSystem';
import { TRAIN_ENERGY, TRAIN_MINUTES, canTrain } from '../../core/systems/CalendarSystem';
import { bar, esc, icon } from '../dom';
import type { Screen, ScreenDeps } from './Screen';

export class TrainingScreen implements Screen {
  readonly id = 'ludus' as const;
  readonly title = 'Ludus';
  readonly tip = 'Treinar é de graça: gasta só energia e tempo. Atributos já treinados evoluem mais devagar.';

  constructor(private readonly d: ScreenDeps) {}

  render(p: PlayerState): string {
    const busy = this.d.actions.training;
    const err = canTrain(p);
    const cards = TRAININGS.map((t) => {
      const tp = p.training[t.id];
      const info = ATTRIBUTE_INFO[t.id];
      const left = sessionsToNext(p, t.id);
      return `<div class="card train-card" title="${esc(t.description)}">
        <div class="train-head">${icon(info.icon)}<span>${esc(info.name)}</span><b>${p.baseAttributes[t.id] + p.trainedBonus[t.id]}</b></div>
        ${bar(tp.progress, TRAINING_THRESHOLD, 'train', false)}
        <div class="tiny dim center">faltam ${left} treino${left > 1 ? 's' : ''} para +1</div>
        <button class="btn btn-gold wide" data-action="train" data-id="${t.id}" ${busy || err ? 'disabled' : ''}>${busy ? '…' : 'Treinar'}</button>
      </div>`;
    }).join('');
    return `<p class="hint ${err ? 'red' : ''}">${err ?? `Cada treino: ${icon('attr_res', 'xs')} −${TRAIN_ENERGY} energia · ${TRAIN_MINUTES / 60} hora`}</p><div class="train-grid">${cards}</div>`;
  }

  onAction(action: string, el: HTMLElement): void {
    if (action === 'train') this.d.actions.train(el.dataset.id as TrainingId);
  }
}
