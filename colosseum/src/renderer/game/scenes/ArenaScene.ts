// Cena da arena: executa o CombatEngine em tempo real e traduz seus eventos
// em animações e sons. A lógica (quem acerta, dano, etc.) vem só do motor.
import * as Phaser from 'phaser';
import { CombatEngine, TICK } from '../../core/combat/CombatEngine';
import type { FighterVisual } from '../../core/combat/CombatantFactory';
import type { ActionKind, CombatantSpec, CombatEvent, CombatResult, FighterState, Side } from '../../core/combat/CombatTypes';
import type { ArenaDef } from '../../core/data/arenas';
import { t } from '../../i18n';
import { arenaName, skillName } from '../../i18n/data';
import { sound } from '../../audio/SoundManager';
import { WORLD } from '../assets';
import { SkyLayer } from '../DayNight';
import { GladiatorView } from '../entities/Gladiator';
import { bigText, dust, floatText, sparks } from '../fx';
import { frameCamera, type Insets } from '../layout';
import { speech } from '../speech';
import type { PlayerLook } from '../portraits';
import { talk, type TalkMoment } from '../../core/data/dialogue';

export const GROUND_Y = 318;
/** escala dos lutadores na arena */
export const FIGHTER_SCALE = 1.3;
/** afastamento visual extra de cada lutador (o motor usa distâncias curtas) */
const SPREAD = 17;
const HEAD_Y = GROUND_Y - 44 * FIGHTER_SCALE;

/** Deslocamentos visuais de coreografia (não afetam o motor). */
interface Choreo {
  /** avanço na direção do adversário (investida) */
  lunge: number;
  /** recuo empurrado pelo golpe/esquiva */
  push: number;
  /** altura do salto */
  lift: number;
  /** inclinação (graus, para trás) */
  tilt: number;
}

const LUNGE: Record<string, number> = { normal: 13, power_strike: 20, quick_strike: 9, counter: 12 };

export interface BattleSetup {
  fighters: [{ spec: CombatantSpec; visual: FighterVisual }, { spec: CombatantSpec; visual: FighterVisual }];
  arena: ArenaDef;
  seed: number;
  speed: number;
  insets: Insets;
  time: () => number;
  /** diálogo: voz do adversário (personalidade), nome do jogador, tipo de entrada e retratos */
  talk?: { opponentId: string; playerName: string; intro?: TalkMoment; portrait?: string; player?: PlayerLook };
  /** dia de festival: arquibancada lotada e enfeitada */
  festival?: boolean;
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
  /** pausa curta no impacto de golpes fortes (sensação de peso) */
  private freeze = 0;
  private talkInfo: BattleSetup['talk'];
  private hurtSaid = [false, false];
  private lastQuip = -99;
  private choreo: Choreo[] = [];
  private choreoTweens = new Map<string, Phaser.Tweens.Tween[]>();
  /** direção de cada lutador para o adversário */
  private dirTo: Array<1 | -1> = [1, -1];
  /** câmera lenta e aproximação no golpe final */
  private slow = 1;
  private slowTimer = 0;
  private zoomBoost = 1;
  private zoomTarget = 1;
  private cineFocus: { x: number; y: number } | null = null;
  /** público de pé (ovação) */
  private standing = 0;
  private festival = false;

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
    this.freeze = 0;
    this.engine = new CombatEngine(setup.fighters[0].spec, setup.fighters[1].spec, { seed: setup.seed });

    this.sky = new SkyLayer(this, setup.time, 150);
    this.add.image(0, 0, setup.arena.bg).setOrigin(0);
    this.festival = !!setup.festival;
    this.crowd = this.add.sprite(0, 0, this.festival ? `bg:crowdfest_${setup.arena.id}` : setup.arena.crowd, 0).setOrigin(0);
    if (this.festival) {
      this.add.image(0, 0, 'fx:festival').setOrigin(0).setDepth(1);
      this.time.addEvent({ delay: 260, loop: true, callback: () => this.petal() });
    }
    this.slow = 1;
    this.slowTimer = 0;
    this.zoomBoost = 1;
    this.zoomTarget = 1;
    this.cineFocus = null;
    this.standing = 0;
    this.glows = [];
    for (const x of [112, 528]) {
      this.add.sprite(x, 200, 'fx:brazier').setOrigin(0.5, 1).play('brazier').setDepth(2);
      this.glows.push(this.add.image(x, 184, 'fx:glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(501));
    }

    this.views = this.engine.fighters.map((f, i) => {
      const v = new GladiatorView(this, f.x, GROUND_Y, setup.fighters[i].visual);
      v.setBaseScale(FIGHTER_SCALE);
      v.setFacing(f.facing);
      v.setDepth(10 + i);
      v.play('walk', { fps: 8 });
      return v;
    });
    this.prevX = this.engine.fighters.map((f) => f.x);
    this.choreo = [0, 1].map(() => ({ lunge: 0, push: 0, lift: 0, tilt: 0 }));
    this.choreoTweens.clear();
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
    // provocações antes da luta: o adversário fala e o jogador responde
    this.talkInfo = setup.talk;
    this.hurtSaid = [false, false];
    this.lastQuip = -99;
    this.time.delayedCall(900, () => this.say(1, setup.talk?.intro ?? 'intro'));
    this.time.delayedCall(2500, () => this.say(0, 'reply'));
    bigText(this, 320, 230, arenaName(this.arenaDef), '#f4dc8a', 22);
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
    const b = this.zoomBoost;
    const c = this.cineFocus;
    const cx = c ? this.camX + (c.x - this.camX) * Math.min(1, (b - 1) / 0.6) : this.camX;
    const cy = c ? 252 + (c.y - 252) * Math.min(1, (b - 1) / 0.6) : 252;
    frameCamera(this.cameras.main, { x: 0, y: 160, w: 460 / b, h: 175 / b }, this.insets, { x: cx, y: cy }, 6 * b);
  }

  forfeit(): void {
    if (this.engine.finished) return;
    this.engine.forfeit(0);
    for (const e of this.engine.drainEvents()) this.handleEvent(e);
  }

  update(_t: number, delta: number): void {
    const realDt = Math.min(0.1, delta / 1000);
    // câmera lenta do nocaute (volta ao normal aos poucos)
    if (this.slowTimer > 0) {
      this.slowTimer -= realDt;
      if (this.slowTimer <= 0) this.slow = 1;
    }
    this.zoomBoost += (this.zoomTarget - this.zoomBoost) * Math.min(1, realDt * 4);
    let dt = realDt * this.speed * this.slow;
    const ts = this.speed * this.slow;
    if (this.tweens.timeScale !== ts) this.tweens.timeScale = ts;
    if (this.freeze > 0) {
      this.freeze -= realDt;
      dt = 0;
    }
    if (!this.engine.finished && dt > 0) {
      this.acc += dt;
      while (this.acc >= TICK && !this.engine.finished) {
        this.prevX = this.engine.fighters.map((f) => f.x);
        const events = this.engine.step();
        for (const e of events) this.handleEvent(e);
        this.acc -= TICK;
      }
    }
    const alpha = this.engine.finished ? 1 : Math.min(1, this.acc / TICK);
    const ex = this.engine.fighters.map((f, i) => this.prevX[i] + (f.x - this.prevX[i]) * alpha);
    this.dirTo = [ex[1] >= ex[0] ? 1 : -1, ex[0] > ex[1] ? 1 : -1];
    this.engine.fighters.forEach((f, i) => {
      const v = this.views[i];
      const c = this.choreo[i];
      const d = this.dirTo[i];
      const x = Phaser.Math.Clamp(ex[i] - d * SPREAD + d * (c.lunge - c.push), 30, WORLD.width - 30);
      v.setPose(c.lift, c.tilt);
      if (Math.abs(x - v.x) > 0.01 && (f.action === 'advance' || f.action === 'retreat' || f.action === 'intro')) {
        this.dustTimer[i] -= dt;
        if (this.dustTimer[i] <= 0) {
          if (this.sky.weather.rain > 0.15) this.sky.splash(x, GROUND_Y, 1.2);
          else dust(this, x, GROUND_Y, 1);
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
      if (this.endTimer < 0) this.endTimer = 4.6;
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
      if (this.standing > 0) {
        // ovação: o público inteiro de pé, braços para cima
        this.crowdFrame = this.crowdFrame === 3 ? 4 : 3;
        this.crowd.setFrame(this.crowdFrame);
        this.crowdTimer = 0.22;
        return;
      }
      const excited = this.crowdExcite > 0;
      this.crowdFrame = excited ? (this.crowdFrame + 1) % 3 : this.crowdFrame === 0 ? 1 : 0;
      this.crowd.setFrame(this.crowdFrame);
      this.crowdTimer = excited ? 0.15 : 0.7;
    }
  }

  /** Pétalas de flores caindo da arquibancada (festival e vitória). */
  private petal(x = Math.random() * 640, y = 150 + Math.random() * 30): void {
    const colors = [0xe84a5a, 0xf4d06a, 0xf0f0e0, 0xd86ab0];
    const p = this.add.rectangle(x, y, 2, 2, colors[Math.floor(Math.random() * colors.length)]).setDepth(30);
    this.tweens.add({ targets: p, y: GROUND_Y - 2 + Math.random() * 30, x: x + (Math.random() - 0.5) * 60, angle: 360, duration: 2600 + Math.random() * 1600, ease: 'Sine.easeIn', onComplete: () => p.destroy() });
  }

  /** Golpe final: congela, câmera lenta e aproximação no lutador que cai. */
  private finalBlow(target: Side): void {
    this.hitStop(0.22);
    this.slow = 0.3;
    this.slowTimer = 1.7;
    this.zoomTarget = 1.55;
    const v = this.views[target];
    this.cineFocus = { x: (v.x + this.views[1 - target].x) / 2 + (v.x - this.views[1 - target].x) * 0.2, y: GROUND_Y - 34 };
    this.cameras.main.flash(120, 255, 240, 200);
    this.time.delayedCall(1900, () => (this.zoomTarget = 1.25));
  }

  private viewOf(side: Side): GladiatorView {
    return this.views[side];
  }

  /** Anima um campo da coreografia até `to` e (opcionalmente) de volta a 0. */
  private move(side: Side, key: keyof Choreo, to: number, dur: number, back = 0, hold = 0, ease = 'Cubic.easeOut'): void {
    const c = this.choreo[side];
    const id = `${side}:${key}`;
    for (const t of this.choreoTweens.get(id) ?? []) t.remove();
    const list: Phaser.Tweens.Tween[] = [];
    this.choreoTweens.set(id, list);
    list.push(
      this.tweens.add({
        targets: c,
        [key]: to,
        duration: Math.max(1, dur),
        ease,
        onComplete: () => {
          if (back > 0) list.push(this.tweens.add({ targets: c, [key]: 0, delay: hold, duration: back, ease: 'Sine.easeInOut' }));
        },
      }),
    );
  }

  /** Fala de um lutador num balão (personalidade de cada adversário). */
  private say(side: Side, moment: TalkMoment): void {
    const info = this.talkInfo;
    if (!info || !this.views[side]) return;
    const who = side === 0 ? 'player' : info.opponentId;
    const other = side === 0 ? this.engine.fighters[1].spec.name : info.playerName;
    const line = talk(who, moment, Math.floor(Math.random() * 1000), { name: other.split(',')[0] });
    if (line) speech(this, this.views[side], line, { head: 44 * FIGHTER_SCALE + 6, maxW: 130, insetRight: () => this.insets.right });
  }

  /** Arco de corte na frente do atacante (golpes reconhecíveis). */
  private slash(side: Side, kind: string, landed: boolean): void {
    const v = this.viewOf(side);
    const d = this.dirTo[side];
    const power = kind === 'power_strike';
    const r = (power ? 30 : kind === 'quick_strike' ? 20 : 25) * FIGHTER_SCALE * 0.8;
    const cx = v.x + d * 6;
    const cy = GROUND_Y - 30 * FIGHTER_SCALE;
    const g = this.add.graphics().setDepth(40);
    const color = power ? 0xffb050 : kind === 'counter' ? 0x9fd8ff : 0xffffff;
    // arco de cima para baixo na direção do adversário
    const a0 = d === 1 ? -1.25 : Math.PI + 1.25;
    const a1 = d === 1 ? 0.75 : Math.PI - 0.75;
    const draw = (k: number) => {
      g.clear();
      const steps = 10;
      for (let j = 0; j < steps; j++) {
        const t0 = j / steps;
        if (t0 > k) break;
        const a = a0 + (a1 - a0) * t0;
        const w = (power ? 4 : 3) * (1 - Math.abs(t0 - 0.55));
        g.fillStyle(color, landed ? 0.9 : 0.55);
        g.fillRect(Math.round(cx + Math.cos(a) * r - w / 2), Math.round(cy + Math.sin(a) * r - w / 2), Math.max(1, Math.round(w)), Math.max(1, Math.round(w)));
        g.fillStyle(color, 0.35);
        g.fillRect(Math.round(cx + Math.cos(a) * (r - 4)), Math.round(cy + Math.sin(a) * (r - 4)), 2, 2);
      }
    };
    const st = { k: 0 };
    this.tweens.add({ targets: st, k: 1, duration: 90, onUpdate: () => draw(st.k) });
    this.tweens.add({ targets: g, alpha: 0, delay: 110, duration: 160, onComplete: () => g.destroy() });
  }

  private hitStop(t: number): void {
    this.freeze = Math.max(this.freeze, t / Math.max(1, this.speed));
  }

  /** Anel de impacto no escudo. */
  private clang(x: number, y: number): void {
    const ring = this.add.circle(x, y, 3).setStrokeStyle(1.5, 0xfff4c0, 1).setDepth(41);
    this.tweens.add({ targets: ring, radius: 11, alpha: 0, duration: 220, onComplete: () => ring.destroy() });
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
        this.move(f.side, 'lunge', 0, 220);
        this.move(f.side, 'tilt', 0, 160);
        break;
      case 'windup':
        v.sequence([
          ['attack', 0, duration * 0.65],
          ['attack', 1, duration * 0.35],
        ]);
        // antecipação: recua o peso antes de golpear (maior no golpe poderoso)
        this.move(f.side, 'lunge', duration > 0.5 ? -6 : -3, duration * 0.8, 0, 0, 'Sine.easeOut');
        this.move(f.side, 'tilt', duration > 0.5 ? 6 : 3, duration * 0.8);
        break;
      case 'recover':
        v.sequence([
          ['attack', 2, Math.min(0.14, duration * 0.5)],
          ['attack', 3, 9],
        ]);
        // a investida já foi feita no impacto; volta à guarda durante a recuperação
        this.move(f.side, 'tilt', 0, 120);
        break;
      case 'block':
        v.play('block', { restart: true });
        // firma a base atrás do escudo
        this.move(f.side, 'tilt', -3, 120, 200, duration * 1000);
        break;
      case 'dodge':
        v.sequence([
          ['dodge', 0, duration * 0.25],
          ['dodge', 1, duration * 0.45],
          ['dodge', 2, 9],
        ]);
        // salto para trás em arco
        this.move(f.side, 'push', 20, duration * 400, duration * 700, 60);
        this.move(f.side, 'lift', 7, duration * 250, duration * 300, 0, 'Quad.easeOut');
        this.move(f.side, 'tilt', 8, duration * 300, 260, 60);
        dust(this, v.x, GROUND_Y, 4);
        this.sky.splash(v.x, GROUND_Y, 2);
        break;
      case 'hitstun':
        v.sequence([
          ['hit', 0, duration * 0.5],
          ['hit', 1, 9],
        ]);
        this.move(f.side, 'lunge', 0, 60);
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
        bigText(this, this.cameras.main.midPoint.x, HEAD_Y - 24, t('battle.fightBig'));
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
        const ty = HEAD_Y + 12;
        const enemyHitsPlayer = e.target === 0;
        const lunge = LUNGE[e.kind] ?? 12;
        const power = e.kind === 'power_strike';
        // investida: o atacante avança rápido e o golpe desenha um arco
        this.move(e.side, 'lunge', e.outcome === 'miss' ? lunge + 6 : e.outcome === 'block' ? lunge - 4 : lunge, 70, 260, e.outcome === 'miss' ? 220 : 110);
        this.move(e.side, 'tilt', e.outcome === 'miss' ? -9 : -5, 70, 220, 120);
        this.slash(e.side, e.kind, e.outcome === 'hit' || e.outcome === 'block');
        const front = tx + this.dirTo[e.target] * 9 * FIGHTER_SCALE;
        if (e.outcome === 'miss') {
          floatText(this, tx, ty - 6, t('fx.miss'), '#e8e0d0', 13);
          sound.play('whoosh');
        } else if (e.outcome === 'dodge') {
          floatText(this, tx, ty - 6, t('fx.dodge'), '#9fd8ff', 14);
          sound.play('dodge');
          if (this.choreo[e.target].push < 8) this.move(e.target, 'push', 18, 140, 380, 80);
        } else if (e.outcome === 'block') {
          floatText(this, tx, ty - 6, t('fx.blocked', { n: e.damage }), '#d8d8e8', 13);
          sparks(this, front, ty + 8, 0xfff0a0, power ? 10 : 7);
          this.clang(front, ty + 8);
          // o escudo segura, mas o defensor desliza para trás
          this.move(e.target, 'push', power ? 12 : 6, 90, 300, 60);
          dust(this, tx, GROUND_Y, power ? 4 : 2);
          sound.play('block', power ? 1.3 : 1);
        } else {
          target.flash();
          sparks(this, front - this.dirTo[e.target] * 4, ty + 6, 0xffffff, e.crit ? 10 : 5);
          sparks(this, front - this.dirTo[e.target] * 4, ty + 8, 0xc83a2a, e.crit ? 6 : 3);
          // reação ao golpe: é empurrado e tomba o tronco para trás
          const kb = e.stagger ? 16 : 8;
          this.move(e.target, 'push', kb, 110, e.stagger ? 520 : 320, e.stagger ? 160 : 60);
          this.move(e.target, 'tilt', e.stagger ? 14 : 8, 90, 300, e.stagger ? 200 : 60);
          if (e.stagger) dust(this, tx, GROUND_Y, 5);
          const color = enemyHitsPlayer ? '#ff6a5a' : '#ffe08a';
          floatText(this, tx, ty - 6, e.crit ? `${e.damage}!` : `${e.damage}`, color, e.crit ? 19 : 15);
          if (e.crit) {
            floatText(this, tx, ty - 26, t('fx.crit'), '#ffb03a', 12, 14, 800);
            sound.play('crit');
          } else sound.play('hit', e.stagger ? 1.3 : 1);
          if (e.crit || e.stagger) {
            this.cameras.main.shake(140, 0.004);
            this.hitStop(e.crit ? 0.09 : 0.05);
            this.crowdExcite = Math.max(this.crowdExcite, 1.2);
            sound.cheer(0.8);
          }
        }
        if (e.outcome === 'hit' && this.engine.fighters[e.target].hp <= 0) this.finalBlow(e.target);
        if (e.outcome === 'hit') {
          const tf = this.engine.fighters[e.target];
          if (!this.hurtSaid[e.target] && tf.hp > 0 && tf.hp < tf.spec.stats.maxHp * 0.3) {
            this.hurtSaid[e.target] = true;
            this.time.delayedCall(350, () => this.say(e.target, 'hurt'));
          } else if (e.crit && this.engine.time - this.lastQuip > 9 && Math.random() < 0.45) {
            this.lastQuip = this.engine.time;
            this.time.delayedCall(300, () => this.say(e.side, 'crit'));
          }
        }
        if (e.kind === 'counter') floatText(this, this.viewOf(e.side).x, ty - 30, t('fx.counter'), '#ffb03a', 12, 14, 900);
        break;
      }
      case 'skill': {
        const v = this.viewOf(e.side);
        if (e.skill !== 'counter') floatText(this, v.x, HEAD_Y - 12, skillName(e.skill), '#ffd36a', 12, 12, 1100);
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
        floatText(this, this.viewOf(e.side).x, HEAD_Y - 14, t('fx.secondWind', { n: e.heal }), '#8ad866', 12, 14, 1200);
        sound.play('guard');
        break;
      case 'exhausted':
        floatText(this, this.viewOf(e.side).x, HEAD_Y - 10, t('fx.tired'), '#c8c0b0', 12, 10, 1200);
        sound.play('exhausted');
        break;
      case 'end':
        this.views.forEach((v) => v.setAura(false));
        this.crowdExcite = 4;
        // o público se levanta (ovação maior quando o jogador vence)
        this.standing = 1;
        if (e.winner === 0) for (let i = 0; i < 40; i++) this.time.delayedCall(i * 60, () => this.petal(this.views[0].x + (Math.random() - 0.5) * 160, 150 + Math.random() * 20));
        if (this.zoomTarget === 1) {
          this.zoomTarget = 1.25;
          this.cineFocus = { x: this.views[e.winner].x, y: GROUND_Y - 34 };
        }
        sound.cheer(1.5);
        sound.play(e.winner === 0 ? 'victory' : 'defeat');
        this.time.delayedCall(1100, () => this.say(e.winner, 'win'));
        this.time.delayedCall(2300, () => this.say((1 - e.winner) as Side, 'lose'));
        bigText(this, this.cameras.main.midPoint.x, HEAD_Y - 24, e.winner === 0 ? t('result.victory') : t('result.defeat'), e.winner === 0 ? '#ffd36a' : '#e06a5a');
        break;
    }
  }
}
