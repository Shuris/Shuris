import type { GameStore } from '../../core/GameStore';
import type { OpponentDef } from '../../core/data/opponents';
import type { FightMode, LocationId, PlayerState, TrainingId } from '../../core/model/types';

/** Locais da cidade + o mapa + as fichas que podem ser abertas em qualquer lugar. */
export type ScreenId = LocationId | 'map' | 'gladiator' | 'history';

export interface AppActions {
  /** luta: escada (adversário selecionado ou revanche), desafiante avulso ou torneio */
  startBattle(opts?: { mode?: FightMode; opponentId?: string }): void;
  /** torneio de sábado: inscrever, começar e ver a chave */
  tournament(action: 'register' | 'start' | 'bracket'): void;
  /** queda de braço na taverna (domingo à noite) */
  armWrestle(): void;
  /** médico do ludus */
  seeMedic(): void;
  /** o ferreiro comenta o trabalho (balão na cena do mercado) */
  smithSay(text: string): void;
  train(id: TrainingId): void;
  readonly training: boolean;
  open(id: ScreenId): void;
  travel(to: LocationId): void;
  sleep(): void;
  nap(): void;
  bathe(): void;
  tavern(action: 'eat' | 'rumor' | 'talk'): void;
  readEdition(day: number): void;
  winChance(def: OpponentDef): number;
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
