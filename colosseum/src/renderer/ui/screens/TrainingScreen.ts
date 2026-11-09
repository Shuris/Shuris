// Tela de treinamento: sessões pagas que acumulam progresso até +1 atributo.
import type { PlayerState, TrainingId } from '../../core/model/types';
import { ATTRIBUTE_INFO } from '../../core/data/gladiators';
import { TRAININGS, TRAINING_PROGRESS, TRAINING_THRESHOLD, trainingCost, trainingXp } from '../../core/systems/TrainingSystem';
import { bar, esc, icon } from '../dom';
import type { Screen, ScreenDeps } from './Screen';

export class TrainingScreen implements Screen {
  readonly id = 'training' as const;
  readonly title = 'Treinamento';
  readonly tip = `Cada sessão custa moedas e adiciona ${TRAINING_PROGRESS} pontos de progresso. Ao chegar a ${TRAINING_THRESHOLD}, o atributo ganha +1 permanente. O custo aumenta a cada sessão, então combine treinos com lutas.`;

  constructor(private readonly d: ScreenDeps) {}

  render(p: PlayerState): string {
    const busy = this.d.actions.training;
    const cards = TRAININGS.map((t) => {
      const cost = trainingCost(p, t.id);
      const tp = p.training[t.id];
      const info = ATTRIBUTE_INFO[t.id];
      const afford = p.coins >= cost;
      return `<div class="card train-card">
        <div class="row">${icon(info.icon)}<h3>${esc(t.name)}</h3></div>
        <p class="hint">${esc(t.description)}</p>
        <div class="row between small"><span>${esc(info.name)}: <b>${p.baseAttributes[t.id] + p.trainedBonus[t.id]}</b> (treino +${p.trainedBonus[t.id]})</span><span>Sessões: ${tp.sessions}</span></div>
        ${bar(tp.progress, TRAINING_THRESHOLD, 'train')}
        <button class="btn btn-gold wide" data-action="train" data-id="${t.id}" ${!afford || busy ? 'disabled' : ''}>
          ${busy ? 'Treinando…' : `Treinar ${icon('coin', 'xs')} ${cost}`}</button>
        ${afford ? '' : '<div class="tiny red">Moedas insuficientes</div>'}
      </div>`;
    }).join('');
    return `<p class="hint">Cada sessão também concede <b>${trainingXp(p)}</b> de experiência. Suas moedas: ${icon('coin', 'xs')} <b>${p.coins}</b></p>
      <div class="train-grid">${cards}</div>`;
  }

  onAction(action: string, el: HTMLElement): void {
    if (action === 'train') this.d.actions.train(el.dataset.id as TrainingId);
  }
}
