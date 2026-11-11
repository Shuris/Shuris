import * as Phaser from 'phaser';
import { MANIFEST_KEY, getManifest, queueGladiatorSheets } from '../assets';
import { ARENAS } from '../../core/data/arenas';

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
    for (const a of ARENAS) {
      this.load.image(a.bg, `assets/backgrounds/arena_${a.id}.png`);
      this.load.spritesheet(a.crowd, `assets/backgrounds/crowd_${a.id}.png`, { frameWidth: 640, frameHeight: 360 });
    }
    for (const a of ARENAS) this.load.spritesheet(`bg:crowdfest_${a.id}`, `assets/backgrounds/crowdfest_${a.id}.png`, { frameWidth: 640, frameHeight: 360 });
    for (const k of ['festival', 'merchant_cart', 'forge', 'arm_table']) this.load.image(`fx:${k}`, `assets/sprites/fx/${k}.png`);
    for (const k of ['prop_table', 'prop_stool', 'prop_crates', 'prop_basket_fruit', 'prop_basket_bread', 'prop_barrel', 'prop_sacks', 'prop_amphorae']) this.load.image(`fx:${k}`, `assets/sprites/fx/${k}.png`);
    this.load.spritesheet('fx:crowd_front', 'assets/sprites/fx/crowd_front.png', { frameWidth: 640, frameHeight: 44 });
    this.load.image('bg:ludus', 'assets/backgrounds/ludus.png');
    for (const k of ['home', 'market', 'temple', 'forum', 'baths', 'tavern']) this.load.image(`bg:loc_${k}`, `assets/backgrounds/loc_${k}.png`);
    this.load.image('bg:map', 'assets/backgrounds/map.png');
    for (const k of ['sun', 'moon', 'cloud']) this.load.image(`fx:${k}`, `assets/sprites/fx/${k}.png`);
    this.load.spritesheet('fx:brazier', 'assets/sprites/fx/brazier.png', { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet('fx:palus', 'assets/sprites/fx/palus.png', { frameWidth: 24, frameHeight: 56 });
    this.load.image('fx:glow', 'assets/sprites/fx/glow.png');
    this.load.spritesheet('fx:monk', 'assets/sprites/fx/monk.png', { frameWidth: 48, frameHeight: 44 });
    this.load.spritesheet('fx:palus_iron', 'assets/sprites/fx/palus_iron.png', { frameWidth: 24, frameHeight: 56 });
    for (const k of ['tavern_front', 'bed_wool', 'bed_noble', 'up_weights', 'up_stakes', 'up_track']) this.load.image(`fx:${k}`, `assets/sprites/fx/${k}.png`);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.anims.create({
        key: 'brazier',
        frames: this.anims.generateFrameNumbers('fx:brazier', { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      });
      this.game.events.emit('assets-ready');
    });
    this.load.start();
  }
}
