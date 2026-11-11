// Fachada da camada Phaser usada pela interface. A UI nunca manipula cenas diretamente.
import * as Phaser from 'phaser';
import type { FighterVisual } from '../core/combat/CombatantFactory';
import type { LocationId, TrainingId } from '../core/model/types';
import { ArenaScene, type BattleHandlers, type BattleSetup } from './scenes/ArenaScene';
import { BootScene } from './scenes/BootScene';
import { HubScene, type HubData } from './scenes/HubScene';
import { MapScene } from './scenes/MapScene';
import type { Insets } from './layout';

type Current = 'hub' | 'arena' | 'map' | null;

export class GameView {
  readonly game: Phaser.Game;
  readonly ready: Promise<void>;
  private insets: Insets = { right: 0, top: 0, bottom: 0 };
  private current: Current = null;
  /** hora do jogo (0..1), lida continuamente pelas cenas */
  time: () => number = () => 0.4;
  /** minutos do dia (para o mapa mostrar locais fechados) */
  minutes: () => number = () => 480;
  day: () => number = () => 1;

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
      // só cliques diretamente no canvas: cliques nos painéis HTML não atravessam para o mapa
      input: { windowEvents: false },
      banner: false,
      scene: [BootScene, HubScene, ArenaScene, MapScene],
    });
    this.ready = new Promise((resolve) => this.game.events.once('assets-ready', () => resolve()));
  }

  private get hub(): HubScene {
    return this.game.scene.getScene('hub') as HubScene;
  }

  get arena(): ArenaScene {
    return this.game.scene.getScene('arena') as ArenaScene;
  }

  get map(): MapScene {
    return this.game.scene.getScene('map') as MapScene;
  }

  get scene(): Current {
    return this.current;
  }

  /** Céu da cena ativa (usado pela interface e pelos testes). */
  get sky() {
    if (this.current === 'arena') return this.arena.sky;
    if (this.current === 'hub') return this.hub.sky;
    if (this.current === 'map') return this.map.sky;
    return null;
  }

  private stopAll(): void {
    for (const k of ['boot', 'hub', 'arena', 'map']) this.game.scene.stop(k);
  }

  setLayout(insets: Insets): void {
    this.insets = insets;
    if (this.current === 'hub' && this.hub.scene.isActive()) this.hub.setInsets(insets);
    if (this.current === 'arena' && this.arena.scene.isActive()) this.arena.setInsets(insets);
    if (this.current === 'map' && this.map.scene.isActive()) this.map.setInsets(insets);
  }

  showLocation(opts: Omit<HubData, 'insets' | 'time'>): void {
    this.stopAll();
    this.game.scene.start('hub', { ...opts, insets: this.insets, time: () => this.time() });
    this.current = 'hub';
  }

  showMap(current: LocationId, onPick: (id: LocationId) => void): void {
    this.stopAll();
    this.game.scene.start('map', { current, onPick, insets: this.insets, time: () => this.time(), minutes: () => this.minutes(), day: () => this.day() });
    this.current = 'map';
  }

  travelOnMap(id: LocationId, done: () => void): void {
    if (this.current === 'map' && this.map.scene.isActive()) this.map.travelTo(id, done);
    else done();
  }

  refreshMap(): void {
    if (this.current === 'map' && this.map.scene.isActive()) this.map.refreshLabels();
  }

  updateVisual(visual: FighterVisual): void {
    if (this.current === 'hub' && this.hub.scene.isActive()) this.hub.setVisual(visual);
  }

  startBattle(setup: Omit<BattleSetup, 'insets' | 'time'>, handlers: BattleHandlers): void {
    this.stopAll();
    this.game.scene.start('arena', { setup: { ...setup, insets: this.insets, time: () => this.time() }, handlers });
    this.current = 'arena';
  }

  /** Pausa (menu de pausa): congela a cena ativa. */
  setPaused(on: boolean): void {
    const key = this.current;
    if (!key) return;
    const sc = this.game.scene.getScene(key);
    if (!sc || !this.game.scene.isActive(key) && !this.game.scene.isPaused(key)) return;
    if (on && !this.game.scene.isPaused(key)) this.game.scene.pause(key);
    if (!on && this.game.scene.isPaused(key)) this.game.scene.resume(key);
  }

  setSpeed(s: number): void {
    if (this.current === 'arena') this.arena.setSpeed(s);
  }

  forfeit(): void {
    if (this.current === 'arena') this.arena.forfeit();
  }

  /** Polegar da plateia no fim da luta. */
  showThumb(kind: 'up' | 'down' | 'none'): void {
    if (this.current === 'arena') this.arena.showThumb(kind);
  }

  playTraining(kind: TrainingId, done: () => void): boolean {
    if (this.current !== 'hub' || !this.hub.scene.isActive()) return false;
    this.hub.playTraining(kind, done);
    return true;
  }

  playSleep(day: number, done: () => void): boolean {
    if (this.current !== 'hub' || !this.hub.scene.isActive()) return false;
    this.hub.playSleep(day, done);
    return true;
  }

  /** Um figurante da cena atual fala (taverna, templo...). */
  npcSay(kind: string, text: string): boolean {
    return this.current === 'hub' && this.hub.scene.isActive() ? this.hub.say(kind, text) : false;
  }

  heroSay(text: string): void {
    if (this.current === 'hub' && this.hub.scene.isActive()) this.hub.heroSay(text);
  }

  showGain(text: string): void {
    if (this.current === 'hub' && this.hub.scene.isActive()) this.hub.showGain(text);
  }
}
