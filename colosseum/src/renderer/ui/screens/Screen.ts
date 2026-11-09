import type { GameStore } from '../../core/GameStore';
import type { PlayerState, TrainingId } from '../../core/model/types';

export type TabId = 'arena' | 'gladiator' | 'training' | 'equipment' | 'history';

export interface AppActions {
  startBattle(): void;
  train(id: TrainingId): void;
  readonly training: boolean;
  goTab(id: TabId): void;
  winChance(opponentId: string): number;
  refreshVisual(): void;
  rerender(): void;
}

export interface Screen {
  readonly id: TabId;
  readonly title: string;
  readonly tip: string;
  render(p: PlayerState): string;
  onAction(action: string, el: HTMLElement, p: PlayerState): void;
}

export interface ScreenDeps {
  store: GameStore;
  actions: AppActions;
}
