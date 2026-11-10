// Fachada da camada Phaser usada pela interface. A UI nunca manipula cenas diretamente.
import * as Phaser from 'phaser';
import type { FighterVisual } from '../core/combat/CombatantFactory';
import type { DayNightMode, TrainingId } from '../core/model/types';
import { ArenaScene, type BattleHandlers, type BattleSetup } from './scenes/ArenaScene';
import { BootScene } from './scenes/BootScene';
import { HubScene } from './scenes/HubScene';
import type { Insets } from './layout';

export class GameView {
  readonly game: Phaser.Game;
  readonly ready: Promise<void>;
  private insets: Insets = { right: 0, top: 0, bottom: 0 };
  private current: 'hub' | 'arena' | null = null;
  /** modo do ciclo de dia e noite (lido continuamente pelas cenas) */
  dayNight: DayNightMode = 'cycle';

  constructor(parent: HTMLElement) {
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      backgroundColor: '#1a110c',
      pixelArt: true,
      roundPixels: true,
      antialias: false,
      scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth || 800, height: parent.clientHeight || 600 },
      fps: { target: 60 },
      audio: { noAudio: true },
      banner: false,
      scene: [BootScene, HubScene, ArenaScene],
    });
    this.ready = new Promise((resolve) => this.game.events.once('assets-ready', () => resolve()));
  }

  private get hub(): HubScene {
    return this.game.scene.getScene('hub') as HubScene;
  }

  get arena(): ArenaScene {
    return this.game.scene.getScene('arena') as ArenaScene;
  }

  /** Céu da cena ativa (usado pela interface e pelos testes). */
  get sky() {
    if (this.current === 'arena') return this.arena.sky;
    if (this.current === 'hub') return this.hub.sky;
    return null;
  }

  get inBattle(): boolean {
    return this.current === 'arena';
  }

  setLayout(insets: Insets): void {
    this.insets = insets;
    if (this.current === 'hub' && this.hub.scene.isActive()) this.hub.setInsets(insets);
    if (this.current === 'arena' && this.arena.scene.isActive()) this.arena.setInsets(insets);
  }

  showHub(visual: FighterVisual): void {
    this.game.scene.stop('arena');
    this.game.scene.stop('boot');
    this.game.scene.start('hub', { visual, insets: this.insets, dayNight: () => this.dayNight });
    this.current = 'hub';
  }

  updateVisual(visual: FighterVisual): void {
    if (this.current === 'hub' && this.hub.scene.isActive()) this.hub.setVisual(visual);
  }

  startBattle(setup: Omit<BattleSetup, 'insets' | 'dayNight'>, handlers: BattleHandlers): void {
    this.game.scene.stop('hub');
    this.game.scene.start('arena', { setup: { ...setup, insets: this.insets, dayNight: () => this.dayNight }, handlers });
    this.current = 'arena';
  }

  setSpeed(s: number): void {
    if (this.current === 'arena') this.arena.setSpeed(s);
  }

  forfeit(): void {
    if (this.current === 'arena') this.arena.forfeit();
  }

  playTraining(kind: TrainingId, done: () => void): boolean {
    if (this.current !== 'hub' || !this.hub.scene.isActive()) return false;
    this.hub.playTraining(kind, done);
    return true;
  }

  showGain(text: string): void {
    if (this.current === 'hub' && this.hub.scene.isActive()) this.hub.showGain(text);
  }
}
