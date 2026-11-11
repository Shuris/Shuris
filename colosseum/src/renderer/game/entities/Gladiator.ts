// Representação visual de um gladiador: pilha de camadas (corpo, roupas, cabelo,
// equipamentos) que tocam sempre o mesmo quadro. Não contém lógica de combate.
import * as Phaser from 'phaser';
import type { FighterVisual } from '../../core/combat/CombatantFactory';
import { CLOTH_COLORS, HAIR_COLORS } from '../../core/data/gladiators';
import { getManifest, sheetKey, weaponKey, type GladiatorManifest } from '../assets';

interface Step {
  frame: number;
  dur: number;
}

/** escala das feras em relação ao quadro do gladiador */
const BEAST_SCALE: Record<string, number> = { wolf: 0.62, boar: 0.62, bear: 0.78, lion: 0.72 };

export class GladiatorView extends Phaser.GameObjects.Container {
  private manifest: GladiatorManifest;
  private layers: Phaser.GameObjects.Sprite[] = [];
  /** arma: imagem rígida posicionada na mão a cada quadro */
  private weapon: Phaser.GameObjects.Image | null = null;
  private weaponTint: number | null = null;
  private weaponIndex = 0;
  private weaponTop = new Set<number>();
  private baseTints: number[] = [];
  private shadow: Phaser.GameObjects.Ellipse;
  /** corpo (camadas + arma + aura): pode subir (salto) e inclinar sem mover a sombra */
  private rig: Phaser.GameObjects.Container;
  private anim = 'idle';
  private loop = true;
  private fps = 5;
  private frameIdx = 0;
  private frameTime = 0;
  private seq: Step[] | null = null;
  private seqIdx = 0;
  private flashTime = 0;
  private facingDir: 1 | -1 = 1;
  private baseScale = 1;
  speedMul = 1;
  aura: Phaser.GameObjects.Ellipse;

  constructor(scene: Phaser.Scene, x: number, y: number, visual: FighterVisual) {
    super(scene, x, y);
    this.manifest = getManifest(scene);
    this.weaponTop = new Set(this.manifest.weaponTop ?? []);
    this.shadow = scene.add.ellipse(0, 0, 26, 6, 0x000000, 0.28);
    this.add(this.shadow);
    this.rig = scene.add.container(0, 0);
    this.add(this.rig);
    this.aura = scene.add.ellipse(0, -22, 30, 50, 0xffd36a, 0);
    this.aura.setBlendMode(Phaser.BlendModes.ADD);
    this.rig.add(this.aura);
    this.setVisual(visual);
    scene.add.existing(this);
  }

  setVisual(v: FighterVisual): void {
    for (const l of this.layers) l.destroy();
    this.weapon?.destroy();
    this.weapon = null;
    this.layers = [];
    this.baseTints = [];
    const m = this.manifest;
    if (v.beast) {
      // fera: uma folha só, com os mesmos quadros e animações do gladiador
      // as folhas das feras são desenhadas maiores; reduzidas para ficar na proporção de um homem
      const s = this.scene.add.sprite(0, 0, `beast:${v.beast}`, 0).setOrigin(m.originX / m.frameWidth, m.originY / m.frameHeight).setScale(BEAST_SCALE[v.beast] ?? 0.7);
      this.layers.push(s);
      this.baseTints.push(0xffffff);
      this.rig.add(s);
      this.shadow.setSize(34, 6);
      this.applyFrame();
      return;
    }
    const a = v.appearance;
    const entries: Array<{ sheet: string; tint: number; layer: string; weapon?: string }> = [];
    const push = (sheet: string, tint = 0xffffff) => {
      if (m.sheets[sheet]) entries.push({ sheet, tint, layer: m.sheets[sheet].layer });
      else if (sheet.startsWith('weapon_') && m.weapons[sheet.slice(7)]) entries.push({ sheet, tint, layer: 'weapon', weapon: sheet.slice(7) });
    };
    push(`body_back_${a.skin}`);
    push(`body_main_${a.skin}`);
    push('cloth', CLOTH_COLORS[a.clothColor] ?? 0xffffff);
    push('belt');
    push(`body_front_${a.skin}`);
    push(`arm_top_${a.skin}`);
    const hasHelmet = !!v.gear.head;
    if (!hasHelmet) push(`hair_${a.hairStyle}`, HAIR_COLORS[a.hairColor] ?? 0xffffff);
    if (a.beard) push('beard', HAIR_COLORS[a.hairColor] ?? 0xffffff);
    for (const item of Object.values(v.gear)) {
      if (!item) continue;
      for (const s of item.visual.sheets) push(s, item.visual.tint ?? 0xffffff);
    }
    for (const e of v.extra ?? []) push(e.sheet, e.tint ?? 0xffffff);
    const order = new Map(m.layerOrder.map((l, i) => [l, i]));
    entries.sort((x, y) => (order.get(x.layer) ?? 0) - (order.get(y.layer) ?? 0));
    const ox = m.originX / m.frameWidth;
    const oy = m.originY / m.frameHeight;
    for (const e of entries) {
      if (e.weapon) {
        const def = m.weapons[e.weapon];
        const img = this.scene.add.image(0, 0, weaponKey(e.weapon));
        img.setOrigin(def.gripX / img.width, def.gripY / img.height).setTint(e.tint);
        this.weaponTint = e.tint;
        this.weapon = img;
        this.rig.add(img);
        this.weaponIndex = this.rig.getIndex(img);
        continue;
      }
      const s = this.scene.add.sprite(0, 0, sheetKey(e.sheet), 0).setOrigin(ox, oy);
      s.setTint(e.tint);
      this.layers.push(s);
      this.baseTints.push(e.tint);
      this.rig.add(s);
    }
    this.applyFrame();
  }

  setFacing(dir: 1 | -1): void {
    this.facingDir = dir;
    this.setScale(this.baseScale * dir, this.baseScale);
  }

  /** Eleva o corpo (px, positivo = para cima) e inclina (graus, positivo = para trás). */
  setPose(lift: number, tilt: number): void {
    this.rig.y = -lift;
    this.rig.angle = -tilt;
    this.shadow.setScale(1 - Math.min(0.5, lift / 30));
  }

  setBaseScale(s: number): void {
    this.baseScale = s;
    this.setFacing(this.facingDir);
  }

  /** Toca uma animação do manifesto. */
  play(anim: string, opts: { loop?: boolean; fps?: number; restart?: boolean } = {}): void {
    if (!this.active) return;
    const def = this.manifest.animations[anim];
    if (!def) return;
    if (!opts.restart && this.anim === anim && !this.seq && this.loop === (opts.loop ?? def.loop)) {
      if (opts.fps) this.fps = opts.fps;
      return;
    }
    this.seq = null;
    this.anim = anim;
    this.loop = opts.loop ?? def.loop;
    this.fps = opts.fps ?? def.fps;
    this.frameIdx = 0;
    this.frameTime = 0;
    this.applyFrame();
  }

  /** Sequência explícita de quadros (anim, índice, duração) — sincroniza com o motor. */
  sequence(steps: Array<[string, number, number]>): void {
    if (!this.active) return;
    const m = this.manifest.animations;
    this.seq = steps.filter(([a]) => m[a]).map(([a, i, d]) => ({ frame: m[a].start + Math.min(i, m[a].count - 1), dur: d }));
    this.seqIdx = 0;
    this.frameTime = 0;
    this.applyFrame();
  }

  /** Mantém um quadro fixo. */
  hold(anim: string, idx: number): void {
    this.sequence([[anim, idx, 9999]]);
  }

  flash(duration = 0.08): void {
    if (!this.active) return;
    this.flashTime = duration;
    for (const l of this.layers) l.setTintFill(0xffffff);
    this.weapon?.setTintFill(0xffffff);
  }

  setAura(on: boolean): void {
    this.scene.tweens.killTweensOf(this.aura);
    if (on) {
      this.aura.setFillStyle(0xffd36a, 0.22);
      this.scene.tweens.add({ targets: this.aura, alpha: { from: 0.6, to: 1 }, duration: 400, yoyo: true, repeat: -1 });
    } else {
      this.aura.setFillStyle(0xffd36a, 0);
    }
  }

  private currentFrame(): number {
    if (this.seq) return this.seq[Math.min(this.seqIdx, this.seq.length - 1)]?.frame ?? 0;
    const def = this.manifest.animations[this.anim];
    return def.start + this.frameIdx;
  }

  private applyFrame(): void {
    // personagem já removido da cena (ex.: figurante que saiu por causa da chuva)
    if (!this.active) return;
    const f = this.currentFrame();
    for (const l of this.layers) l.setFrame(f);
    const hand = this.manifest.hands[f];
    if (this.weapon && hand) {
      this.weapon.setPosition(Math.round(hand[0] - this.manifest.originX), Math.round(hand[1] - this.manifest.originY));
      this.weapon.setAngle(hand[2]);
      // nos golpes a arma passa à frente do escudo
      if (this.weaponTop.has(f)) this.rig.bringToTop(this.weapon);
      else if (this.rig.getIndex(this.weapon) !== this.weaponIndex) this.rig.moveTo(this.weapon, this.weaponIndex);
    }
  }

  tick(dt: number): void {
    if (!this.active) return;
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      if (this.flashTime <= 0) {
        this.layers.forEach((l, i) => (l.clearTint(), l.setTint(this.baseTints[i])));
        if (this.weapon) {
          const t = this.weapon.tintTopLeft;
          this.weapon.clearTint();
          this.weapon.setTint(this.weaponTint ?? t);
        }
      }
    }
    this.frameTime += dt * this.speedMul;
    if (this.seq) {
      const step = this.seq[this.seqIdx];
      if (step && this.frameTime >= step.dur && this.seqIdx < this.seq.length - 1) {
        this.frameTime -= step.dur;
        this.seqIdx++;
        this.applyFrame();
      }
      return;
    }
    const def = this.manifest.animations[this.anim];
    const spf = 1 / this.fps;
    if (this.frameTime >= spf) {
      this.frameTime -= spf;
      if (this.frameIdx < def.count - 1) this.frameIdx++;
      else if (this.loop) this.frameIdx = 0;
      this.applyFrame();
    }
  }
}
