import * as Phaser from 'phaser';
import { MANIFEST_KEY, getManifest, queueGladiatorSheets } from '../assets';
import { ARENAS, PRIVATE_ARENAS } from '../../core/data/arenas';

/** Carrega o manifesto e, em seguida, todas as folhas e cenários. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    this.load.json(MANIFEST_KEY, 'assets/sprites/gladiator/manifest.json');
  }

  create(): void {
    const m = getManifest(this);
    queueGladiatorSheets(this, m);
    for (const a of [...ARENAS, ...PRIVATE_ARENAS]) {
      this.load.image(a.bg, `assets/backgrounds/arena_${a.id}.png`);
      this.load.spritesheet(a.crowd, `assets/backgrounds/crowd_${a.id}.png`, { frameWidth: 640, frameHeight: 360 });
    }
    for (const a of ARENAS) this.load.spritesheet(`bg:crowdfest_${a.id}`, `assets/backgrounds/crowdfest_${a.id}.png`, { frameWidth: 640, frameHeight: 360 });
    for (const k of ['festival', 'merchant_cart', 'forge', 'arm_table']) this.load.image(`fx:${k}`, `assets/sprites/fx/${k}.png`);
    for (const k of ['prop_table', 'prop_stool', 'prop_crates', 'prop_basket_fruit', 'prop_basket_bread', 'prop_barrel', 'prop_sacks', 'prop_amphorae', 'prop_bed_straw', 'prop_bed_wool', 'prop_bed_noble', 'prop_bench', 'prop_home_amphora', 'prop_home_chest', 'prop_home_rug', 'prop_home_sandals', 'prop_home_stool', 'prop_home_table', 'prop_plant', 'prop_rack', 'prop_shields', 'prop_towels', 'prop_trough']) this.load.image(`fx:${k}`, `assets/sprites/fx/${k}.png`);
    this.load.spritesheet('fx:crowd_front', 'assets/sprites/fx/crowd_front.png', { frameWidth: 1280, frameHeight: 44 });
    this.load.image('bg:ludus', 'assets/backgrounds/ludus.png');
    for (const k of ['home', 'market', 'temple', 'forum', 'baths', 'tavern']) this.load.image(`bg:loc_${k}`, `assets/backgrounds/loc_${k}.png`);
    this.load.image('bg:map', 'assets/backgrounds/map.png');
    for (const k of ['sun', 'moon', 'cloud']) this.load.image(`fx:${k}`, `assets/sprites/fx/${k}.png`);
    this.load.spritesheet('fx:brazier', 'assets/sprites/fx/brazier.png', { frameWidth: 16, frameHeight: 32 });
    for (const b of ['lion', 'bear', 'wolf', 'boar', 'dog', 'cat']) this.load.spritesheet(`beast:${b}`, `assets/sprites/beasts/beast_${b}.png`, { frameWidth: 112, frameHeight: 88 });
    for (const k of ['injured', 'tired', 'motivated']) this.load.image(`st:${k}`, `assets/ui/icons/st_${k}.png`);
    this.load.spritesheet('fx:pigeon', 'assets/sprites/fx/pigeon.png', { frameWidth: 16, frameHeight: 12 });
    this.load.spritesheet('fx:bird', 'assets/sprites/fx/bird.png', { frameWidth: 9, frameHeight: 5 });
    this.load.spritesheet('fx:banner_wave', 'assets/sprites/fx/banner_wave.png', { frameWidth: 16, frameHeight: 34 });
    this.load.spritesheet('fx:editor_group', 'assets/sprites/fx/editor_group.png', { frameWidth: 72, frameHeight: 50 });
    this.load.spritesheet('fx:editor_box', 'assets/sprites/fx/editor_box.png', { frameWidth: 80, frameHeight: 64 });
    for (const k of ['gate_bars', 'tribune']) this.load.image(`fx:${k}`, `assets/sprites/fx/${k}.png`);
    this.load.spritesheet('fx:lamp_flame', 'assets/sprites/fx/lamp_flame.png', { frameWidth: 6, frameHeight: 8 });
    this.load.spritesheet('fx:palus', 'assets/sprites/fx/palus.png', { frameWidth: 24, frameHeight: 56 });
    this.load.image('fx:glow', 'assets/sprites/fx/glow.png');
    this.load.spritesheet('fx:monk', 'assets/sprites/fx/monk.png', { frameWidth: 48, frameHeight: 44 });
    this.load.spritesheet('fx:palus_iron', 'assets/sprites/fx/palus_iron.png', { frameWidth: 24, frameHeight: 56 });
    for (const k of ['tavern_front', 'up_weights', 'up_stakes', 'up_track']) this.load.image(`fx:${k}`, `assets/sprites/fx/${k}.png`);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.anims.create({
        key: 'brazier',
        frames: this.anims.generateFrameNumbers('fx:brazier', { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      });
      const sheetAnim = (key: string, tex: string, start: number, end: number, frameRate: number) =>
        this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex, { start, end }), frameRate, repeat: -1 });
      sheetAnim('pigeon_walk', 'fx:pigeon', 0, 1, 6);
      sheetAnim('pigeon_peck', 'fx:pigeon', 2, 3, 5);
      sheetAnim('pigeon_fly', 'fx:pigeon', 4, 5, 10);
      sheetAnim('bird_fly', 'fx:bird', 0, 1, 5);
      sheetAnim('banner_wave', 'fx:banner_wave', 0, 3, 6);
      for (const k of ['group', 'box']) {
        sheetAnim(`editor_${k}_watch`, `fx:editor_${k}`, 0, 1, 1.2);
        sheetAnim(`editor_${k}_cheer`, `fx:editor_${k}`, 2, 3, 4);
      }
      this.anims.create({
        key: 'lamp_flame',
        frames: this.anims.generateFrameNumbers('fx:lamp_flame', { start: 0, end: 3 }),
        frameRate: 7,
        repeat: -1,
      });
      this.game.events.emit('assets-ready');
    });
    this.load.start();
  }
}
