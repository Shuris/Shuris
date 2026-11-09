// Cena da arena: executa o CombatEngine em tempo real e traduz seus eventos
// em animações. A lógica (quem acerta, dano, etc.) vem exclusivamente do motor.
import * as Phaser from 'phaser';
import { CombatEngine, TICK } from '../../core/combat/CombatEngine';
import type { FighterVisual } from '../../core/combat/CombatantFactory';
import type { ActionKind, CombatantSpec, CombatEvent, CombatResult, FighterState, Side } from '../../core/combat/CombatTypes';
import { SKILLS } from '../../core/data/skills';
import { WORLD } from '../assets';
import { GladiatorView } from '../entities/Gladiator';
import { bigText, dust, floatText, sparks } from '../fx';
import { frameCamera, type Insets } from '../layout';

export const GROUND_Y = 318;

export interface BattleSetup {
  fighters: [{ spec: CombatantSpec; visual: FighterVisual }, { spec: CombatantSpec; visual: FighterVisual }];
  seed: number;
  speed: number;
  insets: Insets;
  compact: boolean;
}

export interface BattleHandlers {
  onReady(engine: CombatEngine): void;
  onEvent(e: CombatEvent, engine: CombatEngine): void;
  onFrame(engine: CombatEngine): void;
  onEnd(result: CombatResult): void;
}

export class ArenaScene extends Phaser.Scene {
  engine!: CombatEngine;
  private views: GladiatorView[] = [];
  private prevX: number[] = [0, 0];
  private acc = 0;
  private speed = 1;
  private handlers!: BattleHandlers;
  private insets: Insets = { right: 0, top: 0, bottom: 0 };
  private compact = false;
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
    this.compact = setup.compact;
    this.acc = 0;
    this.endTimer = -1;
    this.ended = false;
    this.crowdExcite = 1.5;
    this.engine = new CombatEngine(setup.fighters[0].spec, setup.fighters[1].spec, { seed: setup.seed });

    this.add.image(0, 0, 'bg:arena').setOrigin(0);
    this.crowd = this.add.sprite(0, 0, 'bg:crowd', 0).setOrigin(0);
    this.glows = [];
    for (const x of [112, 528]) {
      this.add.sprite(x, 200, 'fx:brazier').setOrigin(0.5, 1).play('brazier');
      this.glows.push(this.add.image(x, 184, 'fx:glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8));
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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
    this.applySpeed();
    this.handlers.onReady(this.engine);
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

  setInsets(i: Insets, compact: boolean): void {
    this.insets = i;
    this.compact = compact;
    this.layout();
  }

  layout(): void {
    if (!this.cameras?.main) return;
    const focus = this.compact ? { x: 0, y: 220, w: 240, h: 110 } : { x: 0, y: 160, w: 460, h: 175 };
    frameCamera(this.cameras.main, focus, this.insets, { x: this.camX, y: this.compact ? 284 : 252 }, 6);
  }

  forfeit(): void {
    if (this.engine.finished) return;
    this.engine.forfeit(0);
    for (const e of this.engine.drainEvents()) this.handleEvent(e);
  }

  update(_t: number, delta: number): void {
    const dt = Math.min(0.1, delta / 1000) * this.speed;
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
          this.dustTimer[i] = 0.25;
        }
      }
      v.x = x;
      if (f.action !== 'victory' && f.action !== 'defeat') v.setFacing(f.facing);
      v.tick(dt);
    });
    // câmera segue o ponto médio dos lutadores (útil no modo companion)
    const mid = (this.views[0].x + this.views[1].x) / 2;
    this.camX += (mid - this.camX) * Math.min(1, dt * 3);
    this.layout();
    this.updateCrowd(dt);
    for (const g of this.glows) g.setAlpha(0.65 + Math.random() * 0.25);
    this.handlers.onFrame(this.engine);

    if (this.engine.finished && !this.ended) {
      if (this.endTimer < 0) this.endTimer = 2.6;
      this.endTimer -= dt / this.speed;
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
        this.crowdExcite = 2;
        break;
      case 'action':
        this.applyActionAnim(this.engine.fighters[e.side], e.action, e.duration);
        break;
      case 'impact': {
        const target = this.viewOf(e.target);
        const tx = target.x;
        const ty = GROUND_Y - 30;
        const enemyHitsPlayer = e.target === 0;
        if (e.outcome === 'miss') {
          floatText(this, tx, ty - 6, 'errou', '#d8d0c0', 10);
        } else if (e.outcome === 'dodge') {
          floatText(this, tx, ty - 6, 'esquiva!', '#8fd0ff', 11);
        } else if (e.outcome === 'block') {
          floatText(this, tx, ty - 6, `bloqueio ${e.damage}`, '#c8c8d8', 10);
          sparks(this, tx - 6 * target.scaleX, ty + 6, 0xfff0a0, 5);
        } else {
          target.flash();
          sparks(this, tx, ty + 4, 0xffffff, e.crit ? 10 : 5);
          const color = enemyHitsPlayer ? '#ff6a5a' : '#ffe08a';
          floatText(this, tx, ty - 6, e.crit ? `${e.damage}!` : `${e.damage}`, color, e.crit ? 15 : 12);
          if (e.crit) floatText(this, tx, ty - 22, 'CRÍTICO', '#ffb03a', 9, 14, 800);
          if (e.crit || e.stagger) {
            this.cameras.main.shake(140, 0.004);
            this.crowdExcite = Math.max(this.crowdExcite, 1.2);
          }
        }
        if (e.kind === 'counter') floatText(this, this.viewOf(e.side).x, ty - 26, 'contra-ataque!', '#ffb03a', 9, 14, 900);
        break;
      }
      case 'skill': {
        const v = this.viewOf(e.side);
        if (e.skill !== 'counter') floatText(this, v.x, GROUND_Y - 58, SKILLS[e.skill].name, '#ffd36a', 9, 12, 1100);
        if (e.skill === 'iron_guard') v.setAura(true);
        break;
      }
      case 'buffEnd':
        this.viewOf(e.side).setAura(false);
        break;
      case 'exhausted':
        floatText(this, this.viewOf(e.side).x, GROUND_Y - 56, 'exausto', '#b0a898', 9, 10, 1200);
        break;
      case 'end':
        this.views.forEach((v) => v.setAura(false));
        this.crowdExcite = 4;
        bigText(this, this.cameras.main.midPoint.x, GROUND_Y - 70, e.winner === 0 ? 'VITÓRIA!' : 'DERROTA', e.winner === 0 ? '#ffd36a' : '#e06a5a');
        break;
    }
  }
}
