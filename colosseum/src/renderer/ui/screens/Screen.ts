import type { GameStore } from '../../core/GameStore';
import type { LocationId, PlayerState, TrainingId } from '../../core/model/types';

/** Locais da cidade + o mapa + as fichas que podem ser abertas em qualquer lugar. */
export type ScreenId = LocationId | 'map' | 'gladiator' | 'history';

export interface AppActions {
  startBattle(): void;
  train(id: TrainingId): void;
  readonly training: boolean;
  open(id: ScreenId): void;
  travel(to: LocationId): void;
  sleep(): void;
  nap(): void;
  bathe(): void;
  tavern(action: 'eat' | 'rumor' | 'talk'): void;
  readEdition(day: number): void;
  winChance(opponentId: string): number;
  refreshVisual(): void;
  rerender(): void;
}

export interface Screen {
  readonly id: ScreenId;
  readonly title: string;
  readonly tip: string;
  render(p: PlayerState): string;
  /** chamado ao abrir a tela */
  onOpen?(p: PlayerState): void;
  onAction(action: string, el: HTMLElement, p: PlayerState): void;
}

export interface ScreenDeps {
  store: GameStore;
  actions: AppActions;
}
