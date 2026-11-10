import type { PlayerState, TrainingId } from '../model/types';
import { MAX_ATTRIBUTE } from '../data/gladiators';
import { grantXp } from './ProgressionSystem';
import { onLevel } from './NewsSystem';
import { createRng, type Rng } from './rng';
import { trainingMul } from '../data/upgrades';
import { t } from '../../i18n';

export const TRAINING_THRESHOLD = 100;
export const TRAINING_PROGRESS = 25;

export interface TrainingDef {
  id: TrainingId;
  name: string;
  description: string;
}

export const TRAININGS: TrainingDef[] = [
  { id: 'str', name: 'Treinamento de força', description: 'Golpes repetidos no palus com pesos de pedra (halteres).' },
  { id: 'res', name: 'Treinamento de resistência', description: 'Corridas na areia carregando o scutum sob o sol.' },
  { id: 'agi', name: 'Treinamento de agilidade', description: 'Esquivas e saltos sobre estacas e cordas.' },
  { id: 'tech', name: 'Treinamento de técnica', description: 'Exercícios de esgrima com o doctor (instrutor) do ludus.' },
];

/**
 * Treinar custa só energia e tempo (no CalendarSystem). Para não evoluir sem
 * lutar, o progresso de cada sessão diminui conforme o atributo já foi treinado.
 */
export function trainingGain(p: PlayerState, id: TrainingId): number {
  return Math.max(6, Math.round((TRAINING_PROGRESS * trainingMul(p, id)) / (1 + p.trainedBonus[id] * 0.12)));
}

/** Sessões que faltam para o próximo +1 no atributo. */
export function sessionsToNext(p: PlayerState, id: TrainingId): number {
  return Math.ceil((TRAINING_THRESHOLD - p.training[id].progress) / trainingGain(p, id));
}

export function trainingXp(p: PlayerState): number {
  return 4 + p.level * 2;
}

export interface TrainingResult {
  ok: boolean;
  message: string;
  attributeGained: boolean;
  xp: number;
  levelUps: number;
}

export function train(p: PlayerState, id: TrainingId, rng: Rng = createRng(Date.now())): TrainingResult {
  if (p.baseAttributes[id] + p.trainedBonus[id] >= MAX_ATTRIBUTE)
    return { ok: false, message: t('train.maxed'), attributeGained: false, xp: 0, levelUps: 0 };
  const tp = p.training[id];
  const gain = trainingGain(p, id);
  tp.sessions++;
  tp.progress += gain;
  let gained = false;
  if (tp.progress >= TRAINING_THRESHOLD) {
    tp.progress -= TRAINING_THRESHOLD;
    p.trainedBonus[id] += 1;
    gained = true;
  }
  const xp = trainingXp(p);
  const levelUps = grantXp(p, xp);
  if (levelUps) onLevel(p, rng);
  return {
    ok: true,
    message: gained ? t('train.gained') : t('train.progress', { n: gain }),
    attributeGained: gained,
    xp,
    levelUps,
  };
}
