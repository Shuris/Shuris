// Clima do cenário: neblina de manhã, folhas caindo no outono e guirlandas nos dias
// de festa. Usado nos locais ao ar livre e no mapa da cidade.
import * as Phaser from 'phaser';
import { morningFog, type Season } from '../core/systems/WeatherSystem';

export interface AmbienceOpts {
  /** minutos do dia agora */
  minutes: () => number;
  season: Season;
  festival: boolean;
  /** área do mundo coberta (neblina e folhas) */
  area: { x: number; y: number; w: number; h: number };
  /** guirlandas: cordões de (x1, y1) a (x2, y2) */
  garlands?: Array<[number, number, number, number]>;
  depth?: number;
}

export interface Ambience {
  update(dt: number): void;
}

export function addAmbience(scene: Phaser.Scene, o: AmbienceOpts): Ambience {
  const depth = o.depth ?? 470;
  const { area } = o;
  // neblina: faixas largas e suaves que derivam devagar
  const fogKey = fogTexture(scene);
  const fogs = [0, 1, 2, 3].map((i) =>
    scene.add
      .image(area.x + (i * area.w) / 3, area.y + area.h * (0.45 + 0.17 * (i % 3)), fogKey)
      .setDisplaySize(area.w * 0.9, area.h * 0.5)
      .setDepth(depth + 1)
      .setAlpha(0)
      .setData('v', 3 + i * 1.5),
  );
  // folhas do outono
  const leaves: Array<{ r: Phaser.GameObjects.Rectangle; vy: number; sway: number; ph: number }> = [];
  if (o.season === 'autumn') {
    const cols = [0xc8642a, 0xe0a030, 0xa83a1e, 0x8a5a24, 0xd88a3a];
    for (let i = 0; i < 28; i++) {
      const r = scene.add.rectangle(area.x + Math.random() * area.w, area.y + Math.random() * area.h, 2, 1, cols[i % cols.length]).setDepth(depth + 2);
      leaves.push({ r, vy: 9 + Math.random() * 10, sway: 6 + Math.random() * 10, ph: Math.random() * 6 });
    }
  }
  if (o.festival) for (const g of o.garlands ?? []) garland(scene, g, depth);
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
      const f = morningFog(o.minutes(), o.season);
      for (const img of fogs) {
        img.setAlpha(f * 0.8);
        if (f <= 0) continue;
        img.x += (img.getData('v') as number) * dt;
        if (img.x - img.displayWidth / 2 > area.x + area.w) img.x = area.x - img.displayWidth / 2;
      }
      for (const l of leaves) {
        l.ph += dt * 2.2;
        l.r.y += l.vy * dt;
        l.r.x += Math.sin(l.ph) * l.sway * dt;
        l.r.setAngle(Math.sin(l.ph * 1.3) * 60);
        if (l.r.y > area.y + area.h) {
          l.r.y = area.y - 4;
          l.r.x = area.x + Math.random() * area.w;
        }
      }
    },
  };
}

/** Cordão de folhas verdes com flores e bandeirolas, pendendo entre dois pontos. */
function garland(scene: Phaser.Scene, [x1, y1, x2, y2]: [number, number, number, number], depth: number): void {
  const g = scene.add.graphics().setDepth(depth);
  const n = Math.max(8, Math.round(Math.hypot(x2 - x1, y2 - y1) / 4));
  const sag = Math.min(18, Math.abs(x2 - x1) * 0.08);
  const pt = (k: number) => ({ x: x1 + (x2 - x1) * k, y: y1 + (y2 - y1) * k + Math.sin(Math.PI * k) * sag });
  const flowers = [0xe84a5a, 0xf4d06a, 0xf0f0e0, 0xd86ab0];
  const pennants = [0xc83a2a, 0xe8c050, 0x3a7ac8, 0xf0f0e0];
  for (let i = 0; i <= n; i++) {
    const p = pt(i / n);
    g.fillStyle(i % 2 ? 0x3e7a32 : 0x5a9a3a, 1).fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 2);
    if (i % 3 === 0) g.fillStyle(flowers[(i / 3) % flowers.length], 1).fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    if (i % 5 === 2) {
      g.fillStyle(pennants[i % pennants.length], 1).fillTriangle(p.x - 2, p.y + 1, p.x + 2, p.y + 1, p.x, p.y + 6);
    }
  }
}

function fogTexture(scene: Phaser.Scene): string {
  const key = 'fx:fog';
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, 128, 48);
  if (!tex) return key;
  const ctx = tex.getContext();
  for (let i = 0; i < 9; i++) {
    const x = 14 + i * 12 + Math.random() * 8;
    const y = 20 + Math.random() * 10;
    const r = 16 + Math.random() * 10;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(240,240,236,0.7)');
    grd.addColorStop(1, 'rgba(236,236,230,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 128, 48);
  }
  tex.refresh();
  return key;
}
