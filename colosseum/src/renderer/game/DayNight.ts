// Ciclo de dia e noite: céu dinâmico (gradiente, sol, lua, estrelas, nuvens),
// iluminação ambiente sobre o cenário e braseiros mais fortes à noite.
import * as Phaser from 'phaser';
import type { DayNightMode } from '../core/model/types';
import { WORLD } from './assets';
import { timeOfDay } from '../core/systems/TimeOfDay';

export interface SkyState {
  top: number;
  bottom: number;
  ambient: number;
  stars: number;
  /** 0 = noite fechada, 1 = dia pleno */
  light: number;
}

const KEYS: Array<[number, SkyState]> = [
  [0.0, { top: 0x0a1028, bottom: 0x1c2848, ambient: 0x7888c0, stars: 1, light: 0 }],
  [0.2, { top: 0x141a3e, bottom: 0x2a2c58, ambient: 0x7c8cc4, stars: 0.8, light: 0.1 }],
  [0.26, { top: 0x3a3a78, bottom: 0xe88a5a, ambient: 0xc0a0a8, stars: 0.2, light: 0.5 }],
  [0.33, { top: 0x5f97cf, bottom: 0xbfdcec, ambient: 0xffffff, stars: 0, light: 1 }],
  [0.68, { top: 0x5f97cf, bottom: 0xbfdcec, ambient: 0xffffff, stars: 0, light: 1 }],
  [0.76, { top: 0x4a3a7a, bottom: 0xf09048, ambient: 0xf0b890, stars: 0.1, light: 0.6 }],
  [0.83, { top: 0x161a40, bottom: 0x3a2a58, ambient: 0x8088c0, stars: 0.8, light: 0.15 }],
  [1.0, { top: 0x0a1028, bottom: 0x1c2848, ambient: 0x7888c0, stars: 1, light: 0 }],
];

function lerpColor(a: number, b: number, t: number): number {
  const ca = Phaser.Display.Color.IntegerToColor(a);
  const cb = Phaser.Display.Color.IntegerToColor(b);
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(ca, cb, 100, Math.round(t * 100));
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

export function skyAt(t: number): SkyState {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [t0, a] = KEYS[i];
    const [t1, b] = KEYS[i + 1];
    if (t >= t0 && t <= t1) {
      const k = (t - t0) / (t1 - t0);
      return {
        top: lerpColor(a.top, b.top, k),
        bottom: lerpColor(a.bottom, b.bottom, k),
        ambient: lerpColor(a.ambient, b.ambient, k),
        stars: a.stars + (b.stars - a.stars) * k,
        light: a.light + (b.light - a.light) * k,
      };
    }
  }
  return KEYS[0][1];
}

/** Camadas do céu e da iluminação para uma cena. */
export class SkyLayer {
  private gfx: Phaser.GameObjects.Graphics;
  private stars: Phaser.GameObjects.Graphics;
  private sun: Phaser.GameObjects.Image;
  private moon: Phaser.GameObjects.Image;
  private clouds: Phaser.GameObjects.Image[] = [];
  private overlay: Phaser.GameObjects.Rectangle;
  private lastDraw = -1;
  state: SkyState = KEYS[3][1];
  t = 0.5;

  constructor(private readonly scene: Phaser.Scene, private readonly mode: () => DayNightMode, private readonly horizon = 150) {
    this.gfx = scene.add.graphics().setDepth(-30);
    this.stars = scene.add.graphics().setDepth(-29);
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * WORLD.width;
      const y = Math.random() * horizon * 0.85;
      this.stars.fillStyle(0xffffff, Math.random() < 0.2 ? 1 : 0.6);
      this.stars.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    this.sun = scene.add.image(0, 0, 'fx:sun').setDepth(-28);
    this.moon = scene.add.image(0, 0, 'fx:moon').setDepth(-28);
    for (let i = 0; i < 4; i++) {
      this.clouds.push(scene.add.image(Math.random() * WORLD.width, 14 + Math.random() * 40, 'fx:cloud').setDepth(-27).setAlpha(0.9));
    }
    // luz ambiente: multiplica as cores do cenário e dos gladiadores
    this.overlay = scene.add
      .rectangle(0, 0, WORLD.width, WORLD.height, 0xffffff)
      .setOrigin(0)
      .setDepth(500)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.update(0);
  }

  update(dt: number): void {
    this.t = timeOfDay(this.mode());
    const s = (this.state = skyAt(this.t));
    const now = this.scene.time.now;
    if (now - this.lastDraw > 400 || this.lastDraw < 0) {
      this.lastDraw = now;
      this.gfx.clear();
      this.gfx.fillGradientStyle(s.top, s.top, s.bottom, s.bottom, 1);
      this.gfx.fillRect(0, 0, WORLD.width, this.horizon);
    }
    this.stars.setAlpha(s.stars);
    this.overlay.setFillStyle(s.ambient, 1);
    // trajetórias do sol (dia) e da lua (noite)
    const arc = (p: number) => ({ x: 40 + p * (WORLD.width - 80), y: this.horizon - Math.sin(Math.PI * p) * (this.horizon - 18) });
    const dayP = (this.t - 0.24) / 0.54;
    const nightP = (((this.t + 0.5) % 1) - 0.24) / 0.54;
    const sp = arc(Phaser.Math.Clamp(dayP, 0, 1));
    const mp = arc(Phaser.Math.Clamp(nightP, 0, 1));
    this.sun.setPosition(sp.x, sp.y).setVisible(dayP > 0 && dayP < 1);
    this.moon.setPosition(mp.x, mp.y).setVisible(nightP > 0 && nightP < 1);
    for (const c of this.clouds) {
      c.x += dt * 4;
      if (c.x > WORLD.width + 30) c.x = -30;
      c.setTint(s.ambient);
      c.setAlpha(0.35 + s.light * 0.55);
    }
  }

  /** Intensidade das fontes de luz (braseiros): fraca de dia, forte à noite. */
  get lampStrength(): number {
    return 0.35 + (1 - this.state.light) * 0.9;
  }
}
