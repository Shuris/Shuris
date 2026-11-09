import * as Phaser from 'phaser';
import { MANIFEST_KEY, getManifest, queueGladiatorSheets } from '../assets';

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
    this.load.image('bg:arena', 'assets/backgrounds/arena.png');
    this.load.image('bg:ludus', 'assets/backgrounds/ludus.png');
    this.load.spritesheet('bg:crowd', 'assets/backgrounds/crowd.png', { frameWidth: 640, frameHeight: 360 });
    this.load.spritesheet('fx:brazier', 'assets/sprites/fx/brazier.png', { frameWidth: 16, frameHeight: 32 });
    this.load.spritesheet('fx:palus', 'assets/sprites/fx/palus.png', { frameWidth: 24, frameHeight: 56 });
    this.load.image('fx:glow', 'assets/sprites/fx/glow.png');
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
