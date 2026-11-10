// Tela de treinamento: cartões grandes, uma ação por cartão.
import type { PlayerState, TrainingId } from '../../core/model/types';
import { ATTRIBUTE_INFO } from '../../core/data/gladiators';
import { TRAININGS, TRAINING_PROGRESS, TRAINING_THRESHOLD, trainingCost } from '../../core/systems/TrainingSystem';
import { bar, esc, icon } from '../dom';
import { TRAIN_ENERGY, canTrain } from '../../core/systems/CalendarSystem';
import type { Screen, ScreenDeps } from './Screen';

const PER_POINT = TRAINING_THRESHOLD / TRAINING_PROGRESS;

export class TrainingScreen implements Screen {
  readonly id = 'ludus' as const;
  readonly title = 'Ludus';
  readonly tip = `Cada ${PER_POINT} treinos dão +1 no atributo. O preço sobe a cada treino.`;

  constructor(private readonly d: ScreenDeps) {}

  render(p: PlayerState): string {
    const busy = this.d.actions.training;
    const err = canTrain(p);
    const cards = TRAININGS.map((t) => {
      const cost = trainingCost(p, t.id);
      const tp = p.training[t.id];
      const info = ATTRIBUTE_INFO[t.id];
      const afford = p.coins >= cost;
      const done = Math.round(tp.progress / TRAINING_PROGRESS);
      return `<div class="card train-card" title="${esc(t.description)}">
        <div class="train-head">${icon(info.icon)}<span>${esc(info.name)}</span><b>${p.baseAttributes[t.id] + p.trainedBonus[t.id]}</b></div>
        ${bar(tp.progress, TRAINING_THRESHOLD, 'train', false)}
        <div class="tiny dim center">${done}/${PER_POINT} para +1</div>
        <button class="btn btn-gold wide" data-action="train" data-id="${t.id}" ${!afford || busy || err ? 'disabled' : ''}>${busy ? '…' : `Treinar ${icon('coin', 'xs')} ${cost}`}</button>
      </div>`;
    }).join('');
    return `<p class="hint ${err ? 'red' : ''}">${err ?? `Cada treino: −${TRAIN_ENERGY} energia, 1 hora.`} ${icon('coin', 'xs')} <b>${p.coins}</b></p><div class="train-grid">${cards}</div>`;
  }

  onAction(action: string, el: HTMLElement): void {
    if (action === 'train') this.d.actions.train(el.dataset.id as TrainingId);
  }
}
