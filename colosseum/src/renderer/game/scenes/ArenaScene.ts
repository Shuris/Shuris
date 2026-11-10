// Cena da arena: executa o CombatEngine em tempo real e traduz seus eventos
// em animações e sons. A lógica (quem acerta, dano, etc.) vem só do motor.
import * as Phaser from 'phaser';
import { CombatEngine, TICK } from '../../core/combat/CombatEngine';
import type { FighterVisual } from '../../core/combat/CombatantFactory';
import type { ActionKind, CombatantSpec, CombatEvent, CombatResult, FighterState, Side } from '../../core/combat/CombatTypes';
import type { ArenaDef } from '../../core/data/arenas';
import { SKILLS } from '../../core/data/skills';
import { sound } from '../../audio/SoundManager';
import { WORLD } from '../assets';
import { SkyLayer } from '../DayNight';
import { GladiatorView } from '../entities/Gladiator';
import { bigText, dust, floatText, sparks } from '../fx';
import { frameCamera, type Insets } from '../layout';

export const GROUND_Y = 318;

export interface BattleSetup {
  fighters: [{ spec: CombatantSpec; visual: FighterVisual }, { spec: CombatantSpec; visual: FighterVisual }];
  arena: ArenaDef;
  seed: number;
  speed: number;
  insets: Insets;
  time: () => number;
}

export interface BattleHandlers {
  onReady(engine: CombatEngine): void;
  onEvent(e: CombatEvent, engine: CombatEngine): void;
  onFrame(engine: CombatEngine): void;
  onEnd(result: CombatResult): void;
}

export class ArenaScene extends Phaser.Scene {
  engine!: CombatEngine;
  arenaDef!: ArenaDef;
  sky!: SkyLayer;
  private views: GladiatorView[] = [];
  private prevX: number[] = [0, 0];
  private acc = 0;
  private speed = 1;
  private handlers!: BattleHandlers;
  private insets: Insets = { right: 0, top: 0, bottom: 0 };
  private crowd!: Phaser.GameObjects.Sprite;
  private crowdTimer = 0;
  private crowdExcite = 0;
  private crowdFrame = 0;
  private endTimer = -1;
  private ended = false;
  private camX = 320;
  private glows: Phaser.GameObjects.Image[] = [];
  private dustTimer = [0, 0];

  constructor() {
    super('arena');
  }

  create(data: { setup: BattleSetup; handlers: BattleHandlers }): void {
    const { setup, handlers } = data;
    this.handlers = handlers;
    this.speed = setup.speed;
    this.insets = setup.insets;
    this.arenaDef = setup.arena;
    this.acc = 0;
    this.endTimer = -1;
    this.ended = false;
    this.crowdExcite = 1.5;
    this.engine = new CombatEngine(setup.fighters[0].spec, setup.fighters[1].spec, { seed: setup.seed });

    this.sky = new SkyLayer(this, setup.time, 150);
    this.add.image(0, 0, setup.arena.bg).setOrigin(0);
    this.crowd = this.add.sprite(0, 0, setup.arena.crowd, 0).setOrigin(0);
    this.glows = [];
    for (const x of [112, 528]) {
      this.add.sprite(x, 200, 'fx:brazier').setOrigin(0.5, 1).play('brazier').setDepth(2);
      this.glows.push(this.add.image(x, 184, 'fx:glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(501));
    }

    this.views = this.engine.fighters.map((f, i) => {
      const v = new GladiatorView(this, f.x, GROUND_Y, setup.fighters[i].visual);
      v.setFacing(f.facing);
      v.setDepth(10 + i);
      v.play('walk', { fps: 8 });
      return v;
    });
    this.prevX = this.engine.fighters.map((f) => f.x);
    this.camX = 320;

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD.width, WORLD.height);
    cam.setBackgroundColor('#1a110c');
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      sound.stopCrowd();
    });
    this.applySpeed();
    sound.startCrowd();
    this.handlers.onReady(this.engine);
    bigText(this, 320, 230, this.arenaDef.name, '#f4dc8a', 22);
  }

  setSpeed(s: number): void {
    this.speed = s;
    this.applySpeed();
  }

  private applySpeed(): void {
    for (const v of this.views) v.speedMul = this.speed;
    this.anims.globalTimeScale = this.speed;
    this.tweens.timeScale = this.speed;
  }

  setInsets(i: Insets): void {
    this.insets = i;
    this.layout();
  }

  layout(): void {
    if (!this.cameras?.main) return;
    frameCamera(this.cameras.main, { x: 0, y: 160, w: 460, h: 175 }, this.insets, { x: this.camX, y: 252 }, 6);
  }

  forfeit(): void {
    if (this.engine.finished) return;
    this.engine.forfeit(0);
    for (const e of this.engine.drainEvents()) this.handleEvent(e);
  }

  update(_t: number, delta: number): void {
    const realDt = Math.min(0.1, delta / 1000);
    const dt = realDt * this.speed;
    if (!this.engine.finished) {
      this.acc += dt;
      while (this.acc >= TICK && !this.engine.finished) {
        this.prevX = this.engine.fighters.map((f) => f.x);
        const events = this.engine.step();
        for (const e of events) this.handleEvent(e);
        this.acc -= TICK;
      }
    }
    const alpha = this.engine.finished ? 1 : Math.min(1, this.acc / TICK);
    this.engine.fighters.forEach((f, i) => {
      const v = this.views[i];
      const x = this.prevX[i] + (f.x - this.prevX[i]) * alpha;
      if (Math.abs(x - v.x) > 0.01 && (f.action === 'advance' || f.action === 'retreat' || f.action === 'intro')) {
        this.dustTimer[i] -= dt;
        if (this.dustTimer[i] <= 0) {
          dust(this, x, GROUND_Y, 1);
          sound.play('step', 0.6);
          this.dustTimer[i] = 0.3;
        }
      }
      v.x = x;
      if (f.action !== 'victory' && f.action !== 'defeat') v.setFacing(f.facing);
      v.tick(dt);
    });
    const mid = (this.views[0].x + this.views[1].x) / 2;
    this.camX += (mid - this.camX) * Math.min(1, dt * 3);
    this.layout();
    this.updateCrowd(dt);
    this.sky.update(realDt);
    const lamp = this.sky.lampStrength;
    for (const g of this.glows) g.setAlpha(lamp * (0.8 + Math.random() * 0.2)).setScale(0.9 + lamp * 0.8);
    this.handlers.onFrame(this.engine);

    if (this.engine.finished && !this.ended) {
      if (this.endTimer < 0) this.endTimer = 2.6;
      this.endTimer -= realDt;
      if (this.endTimer <= 0) {
        this.ended = true;
        this.handlers.onEnd(this.engine.result as CombatResult);
      }
    }
  }

  private updateCrowd(dt: number): void {
    this.crowdExcite = Math.max(0, this.crowdExcite - dt);
    this.crowdTimer -= dt;
    if (this.crowdTimer <= 0) {
      const excited = this.crowdExcite > 0;
      this.crowdFrame = excited ? (this.crowdFrame + 1) % 3 : this.crowdFrame === 0 ? 1 : 0;
      this.crowd.setFrame(this.crowdFrame);
      this.crowdTimer = excited ? 0.15 : 0.7;
    }
  }

  private viewOf(side: Side): GladiatorView {
    return this.views[side];
  }

  private applyActionAnim(f: FighterState, action: ActionKind, duration: number): void {
    const v = this.viewOf(f.side);
    switch (action) {
      case 'intro':
      case 'advance':
        v.play('walk', { fps: 10 });
        break;
      case 'retreat':
        v.play('walk', { fps: 7 });
        break;
      case 'idle':
        v.play('idle');
        break;
      case 'windup':
        v.sequence([
          ['attack', 0, duration * 0.65],
          ['attack', 1, duration * 0.35],
        ]);
        break;
      case 'recover':
        v.sequence([
          ['attack', 2, Math.min(0.14, duration * 0.5)],
          ['attack', 3, 9],
        ]);
        break;
      case 'block':
        v.play('block', { restart: true });
        break;
      case 'dodge':
        v.sequence([
          ['dodge', 0, duration * 0.25],
          ['dodge', 1, duration * 0.45],
          ['dodge', 2, 9],
        ]);
        dust(this, v.x, GROUND_Y, 3);
        break;
      case 'hitstun':
        v.sequence([
          ['hit', 0, duration * 0.5],
          ['hit', 1, 9],
        ]);
        break;
      case 'exhausted':
        v.hold('defeat', 0);
        break;
      case 'buff':
        v.hold('block', 0);
        break;
      case 'victory':
        v.play('victory', { restart: true });
        break;
      case 'defeat':
        v.sequence([
          ['defeat', 0, 0.3],
          ['defeat', 1, 0.3],
          ['defeat', 2, 0.4],
          ['defeat', 3, 99],
        ]);
        break;
    }
  }

  private handleEvent(e: CombatEvent): void {
    this.handlers.onEvent(e, this.engine);
    switch (e.type) {
      case 'start':
        bigText(this, this.cameras.main.midPoint.x, GROUND_Y - 70, 'LUTEM!');
        sound.play('horn');
        sound.cheer(1.2);
        this.crowdExcite = 2;
        break;
      case 'action':
        this.applyActionAnim(this.engine.fighters[e.side], e.action, e.duration);
        break;
      case 'attack':
        if (e.kind === 'power_strike') sound.play('whoosh');
        break;
      case 'impact': {
        const target = this.viewOf(e.target);
        const tx = target.x;
        const ty = GROUND_Y - 30;
        const enemyHitsPlayer = e.target === 0;
        if (e.outcome === 'miss') {
          floatText(this, tx, ty - 6, 'errou', '#e8e0d0', 13);
          sound.play('whoosh');
        } else if (e.outcome === 'dodge') {
          floatText(this, tx, ty - 6, 'esquiva!', '#9fd8ff', 14);
          sound.play('dodge');
        } else if (e.outcome === 'block') {
          floatText(this, tx, ty - 6, `defendeu ${e.damage}`, '#d8d8e8', 13);
          sparks(this, tx - 6 * target.scaleX, ty + 6, 0xfff0a0, 6);
          sound.play('block', e.kind === 'power_strike' ? 1.3 : 1);
        } else {
          target.flash();
          sparks(this, tx, ty + 4, 0xffffff, e.crit ? 10 : 5);
          const color = enemyHitsPlayer ? '#ff6a5a' : '#ffe08a';
          floatText(this, tx, ty - 6, e.crit ? `${e.damage}!` : `${e.damage}`, color, e.crit ? 19 : 15);
          if (e.crit) {
            floatText(this, tx, ty - 26, 'CRÍTICO', '#ffb03a', 12, 14, 800);
            sound.play('crit');
          } else sound.play('hit', e.stagger ? 1.3 : 1);
          if (e.crit || e.stagger) {
            this.cameras.main.shake(140, 0.004);
            this.crowdExcite = Math.max(this.crowdExcite, 1.2);
            sound.cheer(0.8);
          }
        }
        if (e.kind === 'counter') floatText(this, this.viewOf(e.side).x, ty - 30, 'contra-ataque!', '#ffb03a', 12, 14, 900);
        break;
      }
      case 'skill': {
        const v = this.viewOf(e.side);
        if (e.skill !== 'counter') floatText(this, v.x, GROUND_Y - 60, SKILLS[e.skill].name, '#ffd36a', 12, 12, 1100);
        if (e.skill === 'iron_guard') {
          v.setAura(true);
          sound.play('guard');
        } else sound.play('skill');
        break;
      }
      case 'buffEnd':
        this.viewOf(e.side).setAura(false);
        break;
      case 'secondWind':
        floatText(this, this.viewOf(e.side).x, GROUND_Y - 62, `segundo fôlego +${e.heal}`, '#8ad866', 12, 14, 1200);
        sound.play('guard');
        break;
      case 'exhausted':
        floatText(this, this.viewOf(e.side).x, GROUND_Y - 58, 'cansado', '#c8c0b0', 12, 10, 1200);
        sound.play('exhausted');
        break;
      case 'end':
        this.views.forEach((v) => v.setAura(false));
        this.crowdExcite = 4;
        sound.cheer(1.5);
        sound.play(e.winner === 0 ? 'victory' : 'defeat');
        bigText(this, this.cameras.main.midPoint.x, GROUND_Y - 70, e.winner === 0 ? 'VITÓRIA!' : 'DERROTA', e.winner === 0 ? '#ffd36a' : '#e06a5a');
        break;
    }
  }
}
