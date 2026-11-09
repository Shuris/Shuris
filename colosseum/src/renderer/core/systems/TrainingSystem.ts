import type { PlayerState, TrainingId } from '../model/types';
import { MAX_ATTRIBUTE } from '../data/gladiators';
import { grantXp } from './ProgressionSystem';

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

/** Custo progressivo: cresce 18% a cada sessão do mesmo tipo. */
export function trainingCost(p: PlayerState, id: TrainingId): number {
  return Math.round(25 * Math.pow(1.18, p.training[id].sessions));
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

export function train(p: PlayerState, id: TrainingId): TrainingResult {
  const cost = trainingCost(p, id);
  if (p.coins < cost) return { ok: false, message: 'Moedas insuficientes para este treinamento.', attributeGained: false, xp: 0, levelUps: 0 };
  if (p.baseAttributes[id] + p.trainedBonus[id] >= MAX_ATTRIBUTE)
    return { ok: false, message: 'Este atributo já está no máximo.', attributeGained: false, xp: 0, levelUps: 0 };
  p.coins -= cost;
  const t = p.training[id];
  t.sessions++;
  t.progress += TRAINING_PROGRESS;
  let gained = false;
  if (t.progress >= TRAINING_THRESHOLD) {
    t.progress -= TRAINING_THRESHOLD;
    p.trainedBonus[id] += 1;
    gained = true;
  }
  const xp = trainingXp(p);
  const levelUps = grantXp(p, xp);
  return {
    ok: true,
    message: gained ? 'O treino rendeu frutos: +1 ponto de atributo!' : `Progresso de treino +${TRAINING_PROGRESS}.`,
    attributeGained: gained,
    xp,
    levelUps,
  };
}
