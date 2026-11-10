// Ludus: treinar custa apenas energia e tempo (sem moedas).
import type { PlayerState, TrainingId } from '../../core/model/types';
import { ATTRIBUTE_INFO } from '../../core/data/gladiators';
import { TRAININGS, TRAINING_THRESHOLD, sessionsToNext } from '../../core/systems/TrainingSystem';
import { TRAIN_MINUTES, canTrain, trainEnergy } from '../../core/systems/CalendarSystem';
import { trainingMul } from '../../core/data/upgrades';
import { bar, esc, icon } from '../dom';
import { t } from '../../i18n';
import { attrName, trainingDesc } from '../../i18n/data';
import type { Screen, ScreenDeps } from './Screen';

export class TrainingScreen implements Screen {
  readonly id = 'ludus' as const;
  get title() {
    return t('ludus.title');
  }
  get tip() {
    return t('ludus.tip');
  }

  constructor(private readonly d: ScreenDeps) {}

  render(p: PlayerState): string {
    const busy = this.d.actions.training;
    const err = canTrain(p);
    const cards = TRAININGS.map((tr) => {
      const tp = p.training[tr.id];
      const info = ATTRIBUTE_INFO[tr.id];
      const left = sessionsToNext(p, tr.id);
      const boosted = trainingMul(p, tr.id) > 1;
      return `<div class="card train-card" title="${esc(trainingDesc(tr.id))}">
        <div class="train-head">${icon(info.icon)}<span>${esc(attrName(tr.id))}</span><b>${p.baseAttributes[tr.id] + p.trainedBonus[tr.id]}</b></div>
        ${bar(tp.progress, TRAINING_THRESHOLD, 'train', false)}
        <div class="tiny dim center">${t(left > 1 ? 'ludus.leftMany' : 'ludus.leftOne', { n: left })}${boosted ? ` · <span class="gold">${t('ludus.boosted')}</span>` : ''}</div>
        <button class="btn btn-gold wide" data-action="train" data-id="${tr.id}" ${busy || err ? 'disabled' : ''}>${busy ? '…' : t('ludus.train')}</button>
      </div>`;
    }).join('');
    return `<p class="hint ${err ? 'red' : ''}">${err ?? t('ludus.cost', { icon: icon('attr_res', 'xs'), energy: trainEnergy(p), hours: TRAIN_MINUTES / 60 })}</p><div class="train-grid">${cards}</div>`;
  }

  onAction(action: string, el: HTMLElement): void {
    if (action === 'train') this.d.actions.train(el.dataset.id as TrainingId);
  }
}
