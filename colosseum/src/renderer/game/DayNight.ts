// Ciclo de dia e noite: céu dinâmico (gradiente, sol, lua, estrelas, nuvens),
// iluminação ambiente sobre o cenário e braseiros mais fortes à noite.
import * as Phaser from 'phaser';
import { WORLD } from './assets';
import type { WeatherNow } from '../core/systems/WeatherSystem';
import { sound } from '../audio/SoundManager';

/** Clima atual do jogo (definido pela interface a partir do salvamento). */
export const worldWeather = { now: (): WeatherNow => ({ cloud: 0, rain: 0 }) };

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

  private shown = -1;

  /**
   * @param timeFn hora do jogo (0..1); a transição é suave quando o relógio avança
   * @param withSky false para interiores e para o mapa (só a luz ambiente)
   */
  private drops: Array<{ r: Phaser.GameObjects.Rectangle; vy: number; vx: number }> = [];
  private extraClouds: Phaser.GameObjects.Image[] = [];
  weather: WeatherNow = { cloud: 0, rain: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly timeFn: () => number,
    private readonly horizon = 150,
    withSky = true,
    /** chuva atrás do cenário (interiores: só aparece pela janela) */
    rainBehind = false,
  ) {
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
    // nuvens carregadas extras (dias nublados) e gotas de chuva
    for (let i = 0; i < 9; i++) {
      this.extraClouds.push(scene.add.image((i / 9) * WORLD.width + Math.random() * 40, 6 + Math.random() * 46, 'fx:cloud').setDepth(-27).setScale(1.6 + Math.random()).setVisible(false));
    }
    for (let i = 0; i < 240; i++) {
      const r = scene.add.rectangle(Math.random() * WORLD.width, Math.random() * WORLD.height, 1, 8, 0xd0e2f6, 0.8).setDepth(rainBehind ? -26 : 450).setVisible(false);
      this.drops.push({ r, vy: 260 + Math.random() * 90, vx: -40 - Math.random() * 20 });
    }
    if (!withSky) {
      for (const o of [this.gfx, this.stars, this.sun, this.moon, ...this.clouds, ...this.extraClouds]) o.setVisible(false).setActive(false);
      this.skyless = true;
    }
    this.update(0);
  }

  private skyless = false;

  update(dt: number): void {
    const target = this.timeFn();
    if (this.shown < 0) this.shown = target;
    else {
      // aproxima a hora exibida da hora real do jogo pelo caminho mais curto (efeito de passagem do tempo)
      let diff = target - this.shown;
      if (diff > 0.5) diff -= 1;
      if (diff < -0.5) diff += 1;
      this.shown = (this.shown + diff * Math.min(1, dt * 2.5) + 1) % 1;
      if (Math.abs(diff) < 0.0005) this.shown = target;
    }
    this.t = this.shown;
    const w = (this.weather = worldWeather.now());
    const base = skyAt(this.t);
    // tempo fechado: céu cinzento e luz mais fraca
    const grey = (light: number, dark: number) => lerpColor(dark, light, base.light);
    const s = (this.state = {
      top: lerpColor(base.top, grey(0x6a7280, 0x14161e), w.cloud * 0.9),
      bottom: lerpColor(base.bottom, grey(0x9aa2ac, 0x24262e), w.cloud * 0.9),
      ambient: lerpColor(base.ambient, lerpColor(0x4a5060, 0x8c92a2, base.light), w.cloud * 0.85),
      stars: base.stars * (1 - w.cloud),
      light: base.light * (1 - w.cloud * 0.35),
    });
    this.overlay.setFillStyle(s.ambient, 1);
    this.updateRain(dt, w);
    if (this.skyless) return;
    for (const c of this.extraClouds) {
      c.setVisible(w.cloud > 0.2).setAlpha(Math.min(1, w.cloud * 1.2)).setTint(lerpColor(0x5a6070, 0xb0b6c0, base.light));
      c.x += dt * 6;
      if (c.x > WORLD.width + 50) c.x = -50;
    }
    const now = this.scene.time.now;
    if (now - this.lastDraw > 400 || this.lastDraw < 0) {
      this.lastDraw = now;
      this.gfx.clear();
      this.gfx.fillGradientStyle(s.top, s.top, s.bottom, s.bottom, 1);
      this.gfx.fillRect(0, 0, WORLD.width, this.horizon);
    }
    this.stars.setAlpha(s.stars);
    // trajetórias do sol (dia) e da lua (noite)
    const arc = (p: number) => ({ x: 40 + p * (WORLD.width - 80), y: this.horizon - Math.sin(Math.PI * p) * (this.horizon - 18) });
    const dayP = (this.t - 0.24) / 0.54;
    const nightP = (((this.t + 0.5) % 1) - 0.24) / 0.54;
    const sp = arc(Phaser.Math.Clamp(dayP, 0, 1));
    const mp = arc(Phaser.Math.Clamp(nightP, 0, 1));
    this.sun.setPosition(sp.x, sp.y).setVisible(dayP > 0 && dayP < 1 && w.cloud < 0.3);
    this.moon.setPosition(mp.x, mp.y).setVisible(nightP > 0 && nightP < 1 && w.cloud < 0.5);
    for (const c of this.clouds) {
      c.x += dt * 4;
      if (c.x > WORLD.width + 30) c.x = -30;
      c.setTint(s.ambient);
      c.setAlpha(0.35 + s.light * 0.55);
    }
  }

  private updateRain(dt: number, w: WeatherNow): void {
    const active = Math.round(this.drops.length * w.rain);
    this.drops.forEach((d, i) => {
      const on = i < active;
      d.r.setVisible(on);
      if (!on) return;
      d.r.y += d.vy * dt;
      d.r.x += d.vx * dt;
      if (d.r.y > WORLD.height + 5 || d.r.x < -5) {
        d.r.y = -5 - Math.random() * 40;
        d.r.x = Math.random() * (WORLD.width + 60);
      }
    });
    sound.setRain(w.rain);
  }

  /** Intensidade das fontes de luz (braseiros): fraca de dia, forte à noite. */
  get lampStrength(): number {
    return 0.35 + (1 - this.state.light) * 0.9;
  }
}
