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
import { t } from '../../i18n';
import { getItem } from '../../core/data/equipment';
import { npcLine } from '../../core/data/dialogue';
import { speech } from '../speech';
import type { PlayerLook } from '../portraits';

export interface HubData {
  visual: FighterVisual;
  insets: Insets;
  time: () => number;
  location: LocationId;
  bg: string;
  crowd?: string;
  outdoor: boolean;
  /** local aberto: moradores circulando (mercado, taverna) */
  busy?: boolean;
  /** melhorias compradas (aparecem no alojamento e no ludus) */
  upgrades?: string[];
  /** cena sem o gladiador (fundo do menu principal) */
  hideHero?: boolean;
  /** eventos do dia: festival, mercador, queda de braço, ferido */
  festival?: boolean;
  merchant?: boolean;
  armNight?: boolean;
  injured?: boolean;
  /** aparência do jogador para o retrato nos balões */
  heroLook?: PlayerLook;
}

/** Figurante com falas próprias (balões de vez em quando). */
interface Talker {
  who: { x: number; y: number };
  line: string;
  head: number;
}

const GROUND = 312;
/** intensidade de chuva que tira (e devolve) os figurantes da rua */
const RAIN_ON = 0.08;
const RAIN_OFF = 0.03;
/** fontes de luz de cada local (braseiros/lamparinas) */
const LIGHTS: Partial<Record<LocationId, Array<[number, number, boolean]>>> = {
  ludus: [[430, 240, true]],
  home: [[276, 262, false]],
  tavern: [[262, 236, false], [430, 236, false]],
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
  private talkers: Talker[] = [];
  private data_!: HubData;
  /** objetos criados por spawnPeople (refeitos quando começa/para a chuva) */
  private people: Phaser.GameObjects.GameObject[] = [];
  private raining = false;
  private chatTimer = 4;
  /** treinos dos outros gladiadores do ludus */
  private drills: Array<{ t: number; period: number; run: () => void }> = [];

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
    if (data.crowd) {
      const fest = data.festival && data.location === 'arena';
      const id = data.crowd.replace('bg:crowd_', '');
      this.add.sprite(0, 0, fest ? `bg:crowdfest_${id}` : data.crowd, 0).setOrigin(0);
      if (fest) this.add.image(0, 0, 'fx:festival').setOrigin(0).setDepth(1);
    }
    for (const [x, y, brazier] of LIGHTS[data.location] ?? []) {
      if (brazier) this.add.sprite(x, y, 'fx:brazier').setOrigin(0.5, 1).play('brazier').setDepth(3);
      this.glows.push(this.add.image(x, y - 16, 'fx:glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(501));
    }
    this.heroX = data.location === 'ludus' ? 318 : data.location === 'home' ? 340 : data.location === 'temple' ? 360 : 300;
    this.data_ = data;
    this.people = [];
    this.chatTimer = 2.5 + Math.random() * 2;
    const ups = new Set(data.upgrades ?? []);
    // na chuva ninguém fica ao ar livre: o ludus esvazia, o mercado fica só com os
    // vendedores debaixo das tendas e o monge medita dentro do templo
    this.raining = data.outdoor && this.sky.weather.rain > RAIN_ON;
    this.spawnPeople();
    if (data.location === 'ludus') {
      this.palus = this.add.sprite(352, GROUND, ups.has('iron_palus') ? 'fx:palus_iron' : 'fx:palus', 0).setOrigin(0.5, 1).setDepth(4);
      this.add.ellipse(352, GROUND, 18, 5, 0x000000, 0.25).setDepth(3);
    }
    this.hero = new GladiatorView(this, this.heroX, GROUND, data.visual);
    this.hero.setDepth(10);
    this.hero.play('idle');
    if (data.hideHero) this.hero.setVisible(false);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD.width, WORLD.height);
    cam.setBackgroundColor('#1a110c');
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }


  /** Cria os figurantes do local (e as melhorias), conforme o tempo. */
  private spawnPeople(): void {
    const data = this.data_;
    const before = new Set(this.children.list);
    this.npcs = [];
    this.monk = null;
    this.talkers = [];
    this.drills = [];
    const ups = new Set(data.upgrades ?? []);
    if (data.location === 'market' && data.busy) this.spawnTownsfolk();
    if (data.location === 'market') this.spawnMarketExtras(!!data.busy, !!data.merchant);
    if (data.location === 'ludus') this.spawnLudus(ups);
    if (data.location === 'tavern') this.spawnTavern(!!data.busy);
    if (data.location === 'home') this.spawnHome(ups);
    if (data.location === 'temple' && !this.raining) {
      this.monk = this.add.sprite(424, GROUND + 2, 'fx:monk', 0).setOrigin(0.5, 1).setDepth(9);
      this.add.ellipse(424, GROUND, 40, 6, 0x000000, 0.2).setDepth(8);
      this.talkers.push({ who: { x: 424, y: GROUND }, line: 'monk', head: 46 });
    }
    this.people = this.children.list.filter((o) => !before.has(o));
  }

  /** Começou ou parou de chover: refaz os figurantes. */
  private checkRain(): void {
    if (!this.data_?.outdoor) return;
    const r = this.sky.weather.rain;
    const now = this.raining ? r > RAIN_OFF : r > RAIN_ON;
    if (now === this.raining) return;
    this.raining = now;
    for (const o of this.people) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    this.spawnPeople();
  }

  /** Pessoa da cidade (túnica/estola) ou gladiador de treino. */
  private person(opts: { long?: boolean; gladiator?: boolean; old?: boolean; tint?: number } = {}) {
    const rnd = (n: number) => Math.floor(Math.random() * n);
    const appearance = {
      skin: rnd(3),
      hairStyle: opts.long ? 1 : rnd(3),
      hairColor: opts.old ? 5 : rnd(HAIR_COLORS.length - 1),
      beard: opts.old || (!opts.long && Math.random() < 0.45),
      clothColor: rnd(CLOTH_COLORS.length),
    };
    if (opts.gladiator) {
      const weapon = getItem(Math.random() < 0.7 ? 'rudis' : 'short_sword');
      const shield = getItem(Math.random() < 0.6 ? 'parmula' : 'scutum');
      return { appearance, gear: { mainHand: weapon, offHand: shield, ...(Math.random() < 0.4 ? { head: getItem('leather_cap') } : {}) } };
    }
    return { appearance, gear: {}, extra: [{ sheet: opts.long ? 'robe' : 'tunic', tint: opts.tint ?? [0x4a6aa8, 0xd8c890, 0x9a4a3a, 0x6a8a5a, 0xe8dcc0, 0x7a5a8a][rnd(6)] }] };
  }

  /** Ludus: outros gladiadores treinando (duelo de treino, poste e corrida) e as melhorias compradas. */
  private spawnLudus(ups: Set<string>): void {
    const backY = GROUND - 14;
    // equipamentos comprados no mercado
    if (ups.has('stone_weights')) this.add.image(300, GROUND - 30, 'fx:up_weights').setOrigin(0.5, 1).setDepth(2);
    if (ups.has('agility_stakes')) this.add.image(244, GROUND - 26, 'fx:up_stakes').setOrigin(0.5, 1).setDepth(2);
    if (ups.has('sand_track')) this.add.image(330, GROUND - 42, 'fx:up_track').setOrigin(0.5, 1).setDepth(1);
    // segundo poste (os outros gladiadores usam)
    const palus2 = this.add.sprite(452, backY, 'fx:palus', 0).setOrigin(0.5, 1).setDepth(5).setScale(0.92);
    // na chuva, os outros gladiadores e o instrutor treinam lá dentro
    if (this.raining) return;
    // o médico do ludus (Galeno), perto da entrada
    const medic = new GladiatorView(this, 196, GROUND - 6, { ...this.person({ long: true, old: true, tint: 0xe8e0cc }), gear: {} });
    medic.setDepth(7);
    medic.setFacing(1);
    medic.play('idle', { fps: 2 });
    this.npcs.push({ v: medic, speed: 0, min: medic.x, max: medic.x, pause: 0 });
    this.talkers.push({ who: medic, line: this.data_.injured ? 'medicInjured' : 'medic', head: 46 });
    // dupla treinando com rúdis e escudo
    const a = new GladiatorView(this, 226, backY, this.person({ gladiator: true }));
    const b = new GladiatorView(this, 258, backY, this.person({ gladiator: true }));
    b.setFacing(-1);
    for (const v of [a, b]) {
      v.setDepth(6);
      v.setBaseScale(0.92);
      v.play('idle');
      this.npcs.push({ v, speed: 0, min: v.x, max: v.x, pause: 0 });
    }
    b.setFacing(-1);
    let turn = 0;
    this.drills.push({
      t: 0.6,
      period: 1.5,
      run: () => {
        const [atk, def] = turn++ % 2 ? [b, a] : [a, b];
        const dir = atk === a ? 1 : -1;
        atk.sequence([['attack', 0, 0.22], ['attack', 1, 0.08], ['attack', 2, 0.18], ['attack', 3, 0.3], ['idle', 0, 9]]);
        this.tweens.add({ targets: atk, x: atk.x + dir * 6, duration: 90, delay: 300, yoyo: true, hold: 120 });
        this.time.delayedCall(300, () => {
          if (Math.random() < 0.7) {
            def.sequence([['block', 0, 0.35], ['idle', 0, 9]]);
            this.tweens.add({ targets: def, x: def.x + dir * 3, duration: 80, yoyo: true });
          } else def.sequence([['dodge', 0, 0.1], ['dodge', 1, 0.2], ['dodge', 2, 0.15], ['idle', 0, 9]]);
        });
      },
    });
    this.talkers.push({ who: a, line: 'trainee', head: 44 }, { who: b, line: 'trainee', head: 44 });
    // gladiador batendo no segundo poste
    const c = new GladiatorView(this, 426, backY, this.person({ gladiator: true }));
    c.setDepth(6);
    c.setBaseScale(0.92);
    c.play('idle');
    this.npcs.push({ v: c, speed: 0, min: c.x, max: c.x, pause: 0 });
    this.drills.push({
      t: 1.1,
      period: 1.25,
      run: () => {
        c.sequence([['attack', 0, 0.2], ['attack', 1, 0.08], ['attack', 2, 0.18], ['attack', 3, 0.25], ['idle', 0, 9]]);
        this.time.delayedCall(290, () => {
          if (!palus2.active) return;
          palus2.setFrame(1);
          this.time.delayedCall(110, () => palus2.active && palus2.setFrame(0));
        });
      },
    });
    this.talkers.push({ who: c, line: 'trainee', head: 44 });
    // o instrutor do ludus (ou o doctore particular comprado no mercado)
    const doc = new GladiatorView(this, ups.has('doctore') ? 288 : 396, ups.has('doctore') ? GROUND - 4 : backY - 6, { ...this.person({ long: true, old: true, tint: 0x6a2a24 }), gear: { mainHand: getItem('rudis') } });
    doc.setDepth(ups.has('doctore') ? 8 : 5);
    doc.setFacing(1);
    doc.play('idle', { fps: 3 });
    this.npcs.push({ v: doc, speed: 0, min: doc.x, max: doc.x, pause: 0 });
    this.talkers.push({ who: doc, line: ups.has('doctore') ? 'doctore' : 'instructor', head: 48 });
  }

  /** Taverna: a taverneira atrás do balcão, o velho Quintus e fregueses. */
  private spawnTavern(open: boolean): void {
    const keeper = new GladiatorView(this, 404, GROUND - 22, this.person({ long: true, tint: 0x8a3a2a }));
    keeper.setDepth(4);
    keeper.setFacing(-1);
    keeper.play('idle', { fps: 3 });
    this.npcs.push({ v: keeper, speed: 0, min: keeper.x, max: keeper.x, pause: 0 });
    this.add.image(0, 0, 'fx:tavern_front').setOrigin(0).setDepth(5);
    this.talkers.push({ who: keeper, line: 'keeper', head: 48 });
    const quintus = new GladiatorView(this, 236, GROUND - 4, this.person({ old: true, tint: 0x7a6a50 }));
    quintus.setDepth(9);
    quintus.play('idle', { fps: 2 });
    this.npcs.push({ v: quintus, speed: 0, min: quintus.x, max: quintus.x, pause: 0 });
    this.talkers.push({ who: quintus, line: 'quintus', head: 46 });
    if (!open) return;
    if (this.data_.armNight) this.spawnArmWrestling();
    const spots: Array<[number, number, 1 | -1, boolean]> = [
      [204, GROUND - 16, 1, true],
      [290, GROUND - 14, -1, false],
      [458, GROUND + 6, -1, true],
    ];
    for (const [x, y, dir, glad] of spots) {
      const v = new GladiatorView(this, x, y, glad ? { ...this.person({ gladiator: true }), gear: {} } : this.person());
      v.setDepth(y > GROUND - 10 ? 11 : 7);
      v.setFacing(dir);
      v.play('idle', { fps: 3 + Math.random() * 2 });
      this.npcs.push({ v, speed: 0, min: x, max: x, pause: 0 });
      this.talkers.push({ who: v, line: 'patron', head: 46 });
    }
  }

  /** Domingo à noite: dois fregueses na queda de braço e a torcida em volta. */
  private spawnArmWrestling(): void {
    this.add.image(340, GROUND + 6, 'fx:arm_table').setOrigin(0.5, 1).setDepth(12);
    const a = new GladiatorView(this, 322, GROUND + 2, { ...this.person({ gladiator: true }), gear: {} });
    const b = new GladiatorView(this, 358, GROUND + 2, { ...this.person({ gladiator: true }), gear: {} });
    b.setFacing(-1);
    for (const v of [a, b]) {
      v.setDepth(11);
      v.hold('block', 0);
      this.npcs.push({ v, speed: 0, min: v.x, max: v.x, pause: 0 });
    }
    this.talkers.push({ who: a, line: 'armCheer', head: 46 });
    this.drills.push({
      t: 0.5,
      period: 0.9,
      run: () => {
        const push = Math.random() < 0.5 ? a : b;
        this.tweens.add({ targets: push, x: push.x + (push === a ? 2 : -2), duration: 200, yoyo: true });
      },
    });
  }

  /** Mercado: a forja do ferreiro e, em dia de visita, a carroça do mercador viajante. */
  private spawnMarketExtras(open: boolean, merchant: boolean): void {
    this.add.image(536, GROUND + 2, 'fx:forge').setOrigin(0.5, 1).setDepth(4);
    const glow = this.add.image(526, GROUND - 14, 'fx:glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(501).setScale(0.6);
    this.glows.push(glow);
    if (open && !this.raining) {
      const smith = new GladiatorView(this, 506, GROUND - 2, { ...this.person({ tint: 0x6a4a30 }), gear: {} });
      smith.setDepth(8);
      smith.setFacing(1);
      smith.play('idle', { fps: 3 });
      this.npcs.push({ v: smith, speed: 0, min: smith.x, max: smith.x, pause: 0 });
      this.talkers.push({ who: smith, line: 'smith', head: 46 });
      // marteladas na bigorna de vez em quando
      this.drills.push({
        t: 1.4,
        period: 2.6,
        run: () => {
          smith.sequence([['attack', 0, 0.2], ['attack', 2, 0.15], ['attack', 3, 0.3], ['idle', 0, 9]]);
          this.time.delayedCall(330, () => {
            for (let i = 0; i < 4; i++) {
              const sp = this.add.rectangle(530, GROUND - 22, 1, 1, 0xffd070).setDepth(9);
              this.tweens.add({ targets: sp, x: 530 + (Math.random() - 0.5) * 16, y: GROUND - 26 - Math.random() * 8, alpha: 0, duration: 300, onComplete: () => sp.destroy() });
            }
          });
        },
      });
    }
    if (merchant && open) {
      // a carroça tem toldo: o mercador fica nela mesmo com chuva
      this.add.image(226, GROUND + 4, 'fx:merchant_cart').setOrigin(0.5, 1).setDepth(6);
      const m = new GladiatorView(this, 262, GROUND - 4, { ...this.person({ long: true, tint: 0x7a3a8a }), gear: {} });
      m.setDepth(7);
      m.setFacing(-1);
      m.play('idle', { fps: 3 });
      this.npcs.push({ v: m, speed: 0, min: m.x, max: m.x, pause: 0 });
      this.talkers.push({ who: m, line: 'merchant', head: 46 });
    }
  }

  /** Alojamento: a cama comprada no mercado aparece no lugar da cama de palha. */
  private spawnHome(ups: Set<string>): void {
    if (ups.has('bed_noble')) this.add.image(0, 0, 'fx:bed_noble').setOrigin(0).setDepth(2);
    else if (ups.has('bed_wool')) this.add.image(0, 0, 'fx:bed_wool').setOrigin(0).setDepth(2);
  }

  /** De tempos em tempos um figurante diz algo (personalidade). */
  private updateChatter(dt: number): void {
    if (!this.talkers.length || this.busy) return;
    this.chatTimer -= dt;
    if (this.chatTimer > 0) return;
    this.chatTimer = 5 + Math.random() * 5;
    const tk = this.talkers[Math.floor(Math.random() * this.talkers.length)];
    const line = npcLine(tk.line, Math.floor(Math.random() * 1000));
    if (line) speech(this, tk.who, line, { head: tk.head, insetRight: () => this.insets.right });
  }

  /** Fala de um figurante agora (usado pela interface: taverna, templo). */
  say(kind: string, text: string): boolean {
    const tk = this.talkers.find((x) => x.line === kind || (kind === 'medic' && x.line === 'medicInjured') || (kind === 'patron' && x.line === 'armCheer'));
    if (!tk) return false;
    speech(this, tk.who, text, { head: tk.head, ms: 5200, insetRight: () => this.insets.right });
    return true;
  }

  /** Fala do próprio gladiador. */
  heroSay(text: string): void {
    speech(this, this.hero, text, { head: 50, ms: 4200, insetRight: () => this.insets.right });
  }

  /** Moradores: dois comerciantes parados e alguns passantes indo e vindo. */
  private spawnTownsfolk(): void {
    const rnd = (n: number) => Math.floor(Math.random() * n);
    const person = (long: boolean) => ({
      appearance: { skin: rnd(3), hairStyle: long ? 1 : rnd(3), hairColor: rnd(HAIR_COLORS.length), beard: !long && Math.random() < 0.4, clothColor: rnd(CLOTH_COLORS.length) },
      gear: {},
      extra: [{ sheet: long ? 'robe' : 'tunic', tint: [0x4a6aa8, 0xd8c890, 0x9a4a3a, 0x6a8a5a, 0xe8dcc0, 0x7a5a8a][rnd(6)] }],
    });
    // na chuva: só os dois vendedores, abrigados debaixo das tendas; ninguém passeando
    const spots: Array<[number, number, number, number, number]> = this.raining
      ? [
          [252, GROUND - 50, 4, 0, 1],
          [410, GROUND - 50, 4, 0, -1],
        ]
      : [
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
      if (this.raining) v.setBaseScale(0.88);
      this.talkers.push({ who: v, line: this.raining ? 'vendorRain' : speed ? 'shopper' : 'vendor', head: 46 });
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
        bigText(this, cam.midPoint.x, 200, t('common.dayN', { n: day }), '#ffe49a', 26);
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
    this.updateChatter(dt);
    for (const d of this.drills) {
      d.t -= dt;
      if (d.t <= 0) {
        d.t += d.period;
        if (!this.busy) d.run();
      }
    }
    if (this.monk) {
      this.monkTimer += dt;
      this.monk.setFrame(Math.floor(this.monkTimer / 1.1) % 2);
    }
    if (this.sky) {
      this.sky.update(dt);
      this.checkRain();
      const lamp = this.sky.lampStrength;
      for (const g of this.glows) g.setAlpha(lamp * (0.8 + Math.random() * 0.2)).setScale(0.9 + lamp * 0.8);
    }
  }
}
