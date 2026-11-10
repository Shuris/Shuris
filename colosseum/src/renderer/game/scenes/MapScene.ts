// Mapa da cidade: clique num local para viajar até ele.
import * as Phaser from 'phaser';
import type { LocationId } from '../../core/model/types';
import { LOCATIONS, isOpen } from '../../core/data/locations';
import { SkyLayer } from '../DayNight';
import { FONT } from '../fx';
import { frameCamera, type Insets } from '../layout';

export interface MapData {
  current: LocationId;
  insets: Insets;
  time: () => number;
  minutes: () => number;
  onPick: (id: LocationId) => void;
}

export class MapScene extends Phaser.Scene {
  private token!: Phaser.GameObjects.Container;
  private insets: Insets = { right: 0, top: 0, bottom: 0 };
  private data_!: MapData;
  private labels: Array<{ id: LocationId; text: Phaser.GameObjects.Text; ring: Phaser.GameObjects.Ellipse }> = [];
  sky!: SkyLayer;
  traveling = false;

  constructor() {
    super('map');
  }

  create(data: MapData): void {
    this.data_ = data;
    this.insets = data.insets;
    this.traveling = false;
    this.labels = [];
    this.add.image(0, 0, 'bg:map').setOrigin(0);
    const zoom = () => this.cameras.main.zoom;
    for (const loc of LOCATIONS) {
      const [x, y] = loc.map;
      const ring = this.add.ellipse(x, y, 96, 70, 0xffe49a, 0).setStrokeStyle(2, 0xffe49a, 0).setDepth(600);
      const text = this.add
        .text(x, y + 34, loc.name, { fontFamily: FONT, fontSize: '14px', color: '#fff3d6', stroke: '#1a0e08', strokeThickness: 4 })
        .setOrigin(0.5, 0)
        .setDepth(601)
        .setResolution(Math.max(1, Math.ceil(zoom() * (window.devicePixelRatio || 1))));
      const zone = this.add.zone(x, y, 100, 76).setInteractive({ useHandCursor: true }).setDepth(602);
      zone.on('pointerover', () => ring.setStrokeStyle(2, 0xffe49a, 1).setFillStyle(0xffe49a, 0.12));
      zone.on('pointerout', () => ring.setStrokeStyle(2, 0xffe49a, 0).setFillStyle(0xffe49a, 0));
      zone.on('pointerdown', () => {
        if (!this.traveling) this.data_.onPick(loc.id);
      });
      this.labels.push({ id: loc.id, text, ring });
    }
    const [cx, cy] = LOCATIONS.find((l) => l.id === data.current)!.map;
    const marker = this.add.triangle(0, -24, 0, 0, 12, 0, 6, 10, 0xe0584a).setStrokeStyle(1, 0x1a0e08);
    const shadow = this.add.ellipse(0, 0, 12, 5, 0x000000, 0.35);
    const dot = this.add.circle(0, -6, 6, 0xffe49a).setStrokeStyle(2, 0x1a0e08);
    this.token = this.add.container(cx, cy, [shadow, dot, marker]).setDepth(603);
    this.tweens.add({ targets: marker, y: -20, duration: 500, yoyo: true, repeat: -1 });
    this.sky = new SkyLayer(this, data.time, 0, false);
    const cam = this.cameras.main;
    cam.setBackgroundColor('#1a110c');
    this.layout();
    this.refreshLabels();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  setInsets(i: Insets): void {
    this.insets = i;
    this.layout();
  }

  layout(): void {
    if (!this.cameras?.main) return;
    frameCamera(this.cameras.main, { x: 0, y: 0, w: 640, h: 360 }, this.insets, { x: 320, y: 180 }, 4, false);
  }

  /** Locais fechados aparecem esmaecidos. */
  refreshLabels(): void {
    const m = this.data_.minutes();
    for (const l of this.labels) {
      const open = isOpen(LOCATIONS.find((x) => x.id === l.id)!, m);
      l.text.setColor(open ? '#fff3d6' : '#9a8a70');
    }
  }

  /** Move o marcador até o destino e então chama `done`. */
  travelTo(id: LocationId, done: () => void): void {
    const loc = LOCATIONS.find((l) => l.id === id);
    if (!loc || this.traveling) return;
    this.traveling = true;
    this.tweens.add({
      targets: this.token,
      x: loc.map[0],
      y: loc.map[1],
      duration: 900,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.traveling = false;
        done();
      },
    });
  }

  update(_t: number, delta: number): void {
    this.sky?.update(Math.min(0.1, delta / 1000));
  }
}
