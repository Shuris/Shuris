// Cena de local da cidade (ludus, alojamento, mercado, templo, fórum, termas, arena):
// mostra o gladiador no cenário do local. O ludus tem o poste de treino.
import * as Phaser from 'phaser';
import type { FighterVisual } from '../../core/combat/CombatantFactory';
import type { LocationId, TrainingId } from '../../core/model/types';
import { sound } from '../../audio/SoundManager';
import { WORLD } from '../assets';
import { SkyLayer } from '../DayNight';
import { GladiatorView } from '../entities/Gladiator';
import { CLOTH_COLORS, HAIR_COLORS } from '../../core/data/gladiators';
import { dust, floatText, bigText } from '../fx';
import { frameCamera, type Insets } from '../layout';

export interface HubData {
  visual: FighterVisual;
  insets: Insets;
  time: () => number;
  location: LocationId;
  bg: string;
  crowd?: string;
  outdoor: boolean;
  /** mercado aberto: moradores circulando */
  busy?: boolean;
}

const GROUND = 312;
/** fontes de luz de cada local (braseiros/lamparinas) */
const LIGHTS: Partial<Record<LocationId, Array<[number, number, boolean]>>> = {
  ludus: [[430, 240, true]],
  home: [[276, 262, false]],
  temple: [[320, 258, true]],
  arena: [[112, 200, true], [528, 200, true]],
  forum: [[300, 240, true]],
  market: [[170, 240, true], [470, 240, true]],
};

export class HubScene extends Phaser.Scene {
  private hero!: GladiatorView;
  private palus: Phaser.GameObjects.Sprite | null = null;
  private insets: Insets = { right: 0, top: 0, bottom: 0 };
  private busy = false;
  private heroX = 300;
  location: LocationId = 'home';
  sky!: SkyLayer;
  private glows: Phaser.GameObjects.Image[] = [];
  private npcs: Array<{ v: GladiatorView; speed: number; min: number; max: number; pause: number }> = [];
  private monk: Phaser.GameObjects.Sprite | null = null;
  private monkTimer = 0;

  constructor() {
    super('hub');
  }

  create(data: HubData): void {
    this.insets = data.insets;
    this.location = data.location;
    this.busy = false;
    this.glows = [];
    this.palus = null;
    this.sky = new SkyLayer(this, data.time, 150, data.outdoor, !data.outdoor);
    this.add.image(0, 0, data.bg).setOrigin(0);
    if (data.crowd) this.add.sprite(0, 0, data.crowd, 0).setOrigin(0);
    for (const [x, y, brazier] of LIGHTS[data.location] ?? []) {
      if (brazier) this.add.sprite(x, y, 'fx:brazier').setOrigin(0.5, 1).play('brazier').setDepth(3);
      this.glows.push(this.add.image(x, y - 16, 'fx:glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(501));
    }
    this.heroX = data.location === 'ludus' ? 318 : data.location === 'home' ? 340 : data.location === 'temple' ? 384 : 300;
    this.npcs = [];
    this.monk = null;
    if (data.location === 'market' && data.busy) this.spawnTownsfolk();
    if (data.location === 'temple') {
      this.monk = this.add.sprite(262, GROUND + 2, 'fx:monk', 0).setOrigin(0.5, 1).setDepth(9);
      this.add.ellipse(262, GROUND, 40, 6, 0x000000, 0.2).setDepth(8);
    }
    if (data.location === 'ludus') {
      this.palus = this.add.sprite(352, GROUND, 'fx:palus', 0).setOrigin(0.5, 1).setDepth(4);
      this.add.ellipse(352, GROUND, 18, 5, 0x000000, 0.25).setDepth(3);
    }
    this.hero = new GladiatorView(this, this.heroX, GROUND, data.visual);
    this.hero.setDepth(10);
    this.hero.play('idle');
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD.width, WORLD.height);
    cam.setBackgroundColor('#1a110c');
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  /** Moradores: dois comerciantes parados e alguns passantes indo e vindo. */
  private spawnTownsfolk(): void {
    const rnd = (n: number) => Math.floor(Math.random() * n);
    const person = (long: boolean) => ({
      appearance: { skin: rnd(3), hairStyle: long ? 1 : rnd(3), hairColor: rnd(HAIR_COLORS.length), beard: !long && Math.random() < 0.4, clothColor: rnd(CLOTH_COLORS.length) },
      gear: {},
      extra: [{ sheet: long ? 'robe' : 'tunic', tint: [0x4a6aa8, 0xd8c890, 0x9a4a3a, 0x6a8a5a, 0xe8dcc0, 0x7a5a8a][rnd(6)] }],
    });
    const spots: Array<[number, number, number, number, number]> = [
      // x, y, profundidade, velocidade, direção
      [230, GROUND - 14, 9, 0, 1],
      [404, GROUND - 14, 9, 0, -1],
      [200, GROUND - 8, 9, 20, 1],
      [470, GROUND + 10, 11, 24, -1],
      [330, GROUND + 14, 11, 17, 1],
    ];
    for (const [x, y, depth, speed, dir] of spots) {
      const v = new GladiatorView(this, x, y, person(Math.random() < 0.45));
      v.setDepth(depth);
      v.setFacing(dir as 1 | -1);
      v.play(speed ? 'walk' : 'idle', { fps: speed ? 8 : 4 });
      this.npcs.push({ v, speed: speed * dir, min: 186, max: 488, pause: 0 });
    }
  }

  private updateNpcs(dt: number): void {
    for (const n of this.npcs) {
      n.v.tick(dt);
      if (!n.speed) continue;
      if (n.pause > 0) {
        n.pause -= dt;
        if (n.pause <= 0) n.v.play('walk', { fps: 8 });
        continue;
      }
      n.v.x += n.speed * dt;
      if (n.v.x < n.min || n.v.x > n.max) {
        n.speed = -n.speed;
        n.v.x = Phaser.Math.Clamp(n.v.x, n.min, n.max);
        n.v.setFacing(n.speed > 0 ? 1 : -1);
      } else if (Math.random() < dt * 0.15) {
        n.pause = 1 + Math.random() * 2.5; // para para olhar as bancas
        n.v.play('idle');
      }
    }
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
    if (this.busy) return;
    this.busy = true;
    const h = this.hero;
    const hitPalus = () => {
      this.palus?.setFrame(1);
      this.time.delayedCall(120, () => this.palus?.setFrame(0));
      dust(this, 352, GROUND, 2);
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
      for (let i = 0; i < 3; i++) steps.push(() => (h.sequence([['dodge', 0, 0.1], ['dodge', 1, 0.15], ['dodge', 2, 0.15]]), dust(this, h.x, GROUND, 3), sound.play('dodge')));
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
      h.x = this.heroX;
      this.busy = false;
      done();
    });
  }

  /** Dormir: escurece a tela, mostra o novo dia e clareia de novo. */
  playSleep(day: number, done: () => void): void {
    if (this.busy) return;
    this.busy = true;
    const cam = this.cameras.main;
    cam.fadeOut(700, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      done();
      this.time.delayedCall(500, () => {
        cam.fadeIn(900, 0, 0, 0);
        bigText(this, cam.midPoint.x, 200, `Dia ${day}`, '#ffe49a', 26);
        this.busy = false;
      });
    });
  }

  showGain(text: string): void {
    floatText(this, this.hero.x, this.hero.y - 52, text, '#ffd36a', 14, 16, 1400);
  }

  update(_t: number, delta: number): void {
    const dt = Math.min(0.1, delta / 1000);
    this.hero?.tick(dt);
    this.updateNpcs(dt);
    if (this.monk) {
      this.monkTimer += dt;
      this.monk.setFrame(Math.floor(this.monkTimer / 1.1) % 2);
    }
    if (this.sky) {
      this.sky.update(dt);
      const lamp = this.sky.lampStrength;
      for (const g of this.glows) g.setAlpha(lamp * (0.8 + Math.random() * 0.2)).setScale(0.9 + lamp * 0.8);
    }
  }
}
