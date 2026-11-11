// Mapa da cidade: clique num local para viajar até ele.
import * as Phaser from 'phaser';
import type { LocationId } from '../../core/model/types';
import { LOCATIONS, isOpen } from '../../core/data/locations';
import { SkyLayer } from '../DayNight';
import { FONT } from '../fx';
import { frameCamera, type Insets } from '../layout';
import { locationName } from '../../i18n/data';
import { applyLook } from '../shaders';
import { addAmbience, type Ambience } from '../ambience';
import { seasonOf } from '../../core/systems/WeatherSystem';
import { isFestival } from '../../core/systems/EventSystem';

export interface MapData {
  current: LocationId;
  insets: Insets;
  time: () => number;
  minutes: () => number;
  day: () => number;
  onPick: (id: LocationId) => void;
}

/** Distância do nome abaixo do centro de cada prédio e tamanho da área clicável. */
const LABEL: Partial<Record<LocationId, { dy: number; w: number; h: number }>> = {
  arena: { dy: 46, w: 140, h: 90 },
  ludus: { dy: 30, w: 104, h: 60 },
  market: { dy: 24, w: 100, h: 48 },
  forum: { dy: 29, w: 96, h: 64 },
  temple: { dy: 34, w: 78, h: 64 },
  baths: { dy: 24, w: 86, h: 60 },
  home: { dy: 24, w: 74, h: 48 },
  tavern: { dy: 18, w: 72, h: 40 },
};

export class MapScene extends Phaser.Scene {
  private token!: Phaser.GameObjects.Container;
  private insets: Insets = { right: 0, top: 0, bottom: 0 };
  private data_!: MapData;
  private labels: Array<{ id: LocationId; text: Phaser.GameObjects.Text; ring: Phaser.GameObjects.Ellipse; plate: Phaser.GameObjects.Graphics }> = [];
  sky!: SkyLayer;
  traveling = false;
  private ambience: Ambience | null = null;

  constructor() {
    super('map');
  }

  create(data: MapData): void {
    this.data_ = data;
    this.insets = data.insets;
    this.traveling = false;
    this.labels = [];
    this.add.image(0, 0, 'bg:map').setOrigin(0);
    for (const loc of LOCATIONS) {
      const [x, y] = loc.map;
      const lb = LABEL[loc.id] ?? { dy: 30, w: 96, h: 70 };
      const ring = this.add.ellipse(x, y, lb.w, lb.h, 0xffe49a, 0).setStrokeStyle(2, 0xffe49a, 0).setDepth(600);
      const plate = this.add.graphics().setDepth(600.5);
      const text = this.add
        .text(x, y + lb.dy, locationName(loc.id), { fontFamily: FONT, fontSize: '13px', color: '#fff3d6', stroke: '#1a0e08', strokeThickness: 3 })
        .setOrigin(0.5, 0)
        .setDepth(601)
        // texto renderizado em alta resolução: continua nítido com qualquer zoom
        .setResolution(Math.max(4, Math.ceil(4 * (window.devicePixelRatio || 1))));
      const zone = this.add.zone(x, y, lb.w, lb.h).setInteractive({ useHandCursor: true }).setDepth(602);
      zone.on('pointerover', () => ring.setStrokeStyle(2, 0xffe49a, 1).setFillStyle(0xffe49a, 0.12));
      zone.on('pointerout', () => ring.setStrokeStyle(2, 0xffe49a, 0).setFillStyle(0xffe49a, 0));
      zone.on('pointerdown', () => {
        if (!this.traveling) this.data_.onPick(loc.id);
      });
      this.labels.push({ id: loc.id, text, ring, plate });
    }
    const [cx, cy] = LOCATIONS.find((l) => l.id === data.current)!.map;
    const marker = this.add.triangle(0, -24, 0, 0, 12, 0, 6, 10, 0xe0584a).setStrokeStyle(1, 0x1a0e08);
    const shadow = this.add.ellipse(0, 0, 12, 5, 0x000000, 0.35);
    const dot = this.add.circle(0, -6, 6, 0xffe49a).setStrokeStyle(2, 0x1a0e08);
    this.token = this.add.container(cx, cy, [shadow, dot, marker]).setDepth(603);
    this.tweens.add({ targets: marker, y: -20, duration: 500, yoyo: true, repeat: -1 });
    this.sky = new SkyLayer(this, data.time, 0, false);
    // clima no mapa: neblina de manhã, folhas no outono e guirlandas ligando os prédios na festa
    const at = (id: LocationId) => LOCATIONS.find((l) => l.id === id)!.map;
    const link = (a: LocationId, b: LocationId): [number, number, number, number] => [at(a)[0], at(a)[1] - 18, at(b)[0], at(b)[1] - 18];
    this.ambience = addAmbience(this, {
      minutes: () => data.minutes(),
      season: seasonOf(data.day()),
      festival: isFestival(data.day()),
      area: { x: 0, y: 0, w: 640, h: 360 },
      garlands: [link('forum', 'market'), link('forum', 'tavern'), link('forum', 'baths'), link('forum', 'temple'), link('market', 'arena'), link('ludus', 'market')],
      depth: 590,
    });
    const cam = this.cameras.main;
    cam.setBackgroundColor('#1a110c');
    applyLook(this, 'map');
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
    const day = this.data_.day();
    for (const l of this.labels) {
      const open = isOpen(LOCATIONS.find((x) => x.id === l.id)!, m, day);
      l.text.setColor(open ? '#fff3d6' : '#a89a80');
      l.text.setText(locationName(l.id));
      // plaquinha de madeira atrás do nome (legível sobre ruas e telhados)
      const b = l.text.getBounds();
      l.plate.clear();
      l.plate.fillStyle(0x1a0e08, 0.9).fillRoundedRect(b.x - 5, b.y, b.width + 10, b.height + 1, 3);
      l.plate.lineStyle(1, open ? 0xd8b06a : 0x6a5a44, 1).strokeRoundedRect(b.x - 5, b.y, b.width + 10, b.height + 1, 3);
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
    this.ambience?.update(Math.min(0.1, delta / 1000));
  }
}
