// Pátio do ludus: mostra o gladiador do jogador e as animações de treino.
import * as Phaser from 'phaser';
import type { FighterVisual } from '../../core/combat/CombatantFactory';
import type { DayNightMode, TrainingId } from '../../core/model/types';
import { sound } from '../../audio/SoundManager';
import { SkyLayer } from '../DayNight';
import { WORLD } from '../assets';
import { GladiatorView } from '../entities/Gladiator';
import { dust, floatText } from '../fx';
import { frameCamera, type Insets } from '../layout';

export interface HubData {
  visual: FighterVisual;
  insets: Insets;
  dayNight: () => DayNightMode;
}

export class HubScene extends Phaser.Scene {
  private hero!: GladiatorView;
  private palus!: Phaser.GameObjects.Sprite;
  private insets: Insets = { right: 0, top: 0, bottom: 0 };
  private training = false;
  private elapsed = 0;
  sky!: SkyLayer;
  private torch!: Phaser.GameObjects.Image;

  constructor() {
    super('hub');
  }

  create(data: HubData): void {
    this.insets = data.insets;
    this.training = false;
    this.sky = new SkyLayer(this, data.dayNight, 130);
    this.add.image(0, 0, 'bg:ludus').setOrigin(0);
    this.add.sprite(430, 240, 'fx:brazier').setOrigin(0.5, 1).play('brazier').setDepth(3);
    this.torch = this.add.image(430, 224, 'fx:glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(501);
    this.palus = this.add.sprite(352, 312, 'fx:palus', 0).setOrigin(0.5, 1).setDepth(4);
    this.add.ellipse(352, 312, 18, 5, 0x000000, 0.25).setDepth(3);
    this.hero = new GladiatorView(this, 318, 312, data.visual);
    this.hero.setDepth(10);
    this.hero.play('idle');
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD.width, WORLD.height);
    cam.setBackgroundColor('#1a110c');
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  setInsets(i: Insets): void {
    this.insets = i;
    this.layout();
  }

  layout(): void {
    if (!this.cameras?.main) return;
    frameCamera(this.cameras.main, { x: 200, y: 150, w: 260, h: 175 }, this.insets, { x: 335, y: 250 }, 4);
  }

  setVisual(v: FighterVisual): void {
    this.hero?.setVisual(v);
  }

  /** Animação de treino (~1,8 s); `done` é chamado ao final. */
  playTraining(kind: TrainingId, done: () => void): void {
    if (this.training) return;
    this.training = true;
    const h = this.hero;
    const hitPalus = () => {
      this.palus.setFrame(1);
      this.time.delayedCall(120, () => this.palus.setFrame(0));
      dust(this, 352, 312, 2);
      sound.play('train');
    };
    const steps: Array<() => void> = [];
    if (kind === 'str' || kind === 'tech') {
      for (let i = 0; i < 3; i++) {
        steps.push(() => h.sequence([['attack', 0, 0.18], ['attack', 1, 0.08], ['attack', 2, 0.14], ['attack', 3, 0.2]]));
        steps.push(() => hitPalus());
        if (kind === 'tech') steps.push(() => h.sequence([['block', 0, 0.3]]));
      }
    } else if (kind === 'agi') {
      for (let i = 0; i < 3; i++) steps.push(() => (h.sequence([['dodge', 0, 0.1], ['dodge', 1, 0.15], ['dodge', 2, 0.15]]), dust(this, h.x, 312, 3), sound.play('dodge')));
    } else {
      steps.push(() => {
        h.play('walk', { fps: 12 });
        this.tweens.add({ targets: h, x: 250, duration: 700, yoyo: true, onYoyo: () => h.setFacing(-1), onComplete: () => h.setFacing(1) });
      });
    }
    const interval = kind === 'res' ? 1500 : 1800 / steps.length;
    steps.forEach((fn, i) => this.time.delayedCall(i * interval, fn));
    this.time.delayedCall(1800, () => {
      h.play('idle', { restart: true });
      h.x = 318;
      this.training = false;
      done();
    });
  }

  showGain(text: string): void {
    floatText(this, this.hero.x, this.hero.y - 52, text, '#ffd36a', 14, 16, 1400);
  }

  update(_t: number, delta: number): void {
    const dt = Math.min(0.1, delta / 1000);
    this.elapsed += dt;
    this.hero?.tick(dt);
    if (this.sky) {
      this.sky.update(dt);
      this.torch.setAlpha(this.sky.lampStrength * (0.8 + Math.random() * 0.2)).setScale(0.9 + this.sky.lampStrength * 0.8);
    }
  }
}
