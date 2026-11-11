// Boneco do gladiador para a tela de equipamento: as mesmas camadas da cena (corpo,
// roupa, cabelo, armaduras, escudo e arma), montadas num canvas (quadro parado).
import type { FighterVisual } from '../../core/combat/CombatantFactory';
import { CLOTH_COLORS, HAIR_COLORS } from '../../core/data/gladiators';

interface Manifest {
  frameWidth: number;
  frameHeight: number;
  layerOrder: string[];
  sheets: Record<string, { file: string; layer: string }>;
  weapons: Record<string, { file: string; gripX: number; gripY: number }>;
  hands: Array<[number, number, number]>;
}

let manifest: Promise<Manifest> | null = null;
const images = new Map<string, Promise<HTMLImageElement>>();
const cache = new Map<string, string>();

function load(src: string): Promise<HTMLImageElement> {
  let p = images.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    images.set(src, p);
  }
  return p;
}

function hex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

/** Retorna o boneco como data URL (com cache por aparência e equipamento). */
export async function playerDoll(v: FighterVisual): Promise<string> {
  const key = JSON.stringify([v.appearance, Object.values(v.gear).map((i) => i?.id ?? '')]);
  const hit = cache.get(key);
  if (hit) return hit;
  // XHR (como o carregador do Phaser): fetch não lê arquivos locais (file://) no Electron
  manifest ??= new Promise<Manifest>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('GET', 'assets/sprites/gladiator/manifest.json');
    x.responseType = 'json';
    x.onload = () => (x.response ? resolve(x.response as Manifest) : reject(new Error('manifest')));
    x.onerror = () => reject(new Error('manifest'));
    x.send();
  });
  const m = await manifest;
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
  if (!v.gear.head) push(`hair_${a.hairStyle}`, HAIR_COLORS[a.hairColor] ?? 0xffffff);
  if (a.beard) push('beard', HAIR_COLORS[a.hairColor] ?? 0xffffff);
  for (const item of Object.values(v.gear)) {
    if (!item) continue;
    for (const s of item.visual.sheets) push(s, item.visual.tint ?? 0xffffff);
  }
  const order = new Map(m.layerOrder.map((l, i) => [l, i]));
  entries.sort((x, y) => (order.get(x.layer) ?? 0) - (order.get(y.layer) ?? 0));
  const W = m.frameWidth;
  const H = m.frameHeight;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const tmp = document.createElement('canvas');
  tmp.width = W;
  tmp.height = H;
  const tc = tmp.getContext('2d')!;
  const base = 'assets/';
  for (const e of entries) {
    if (e.weapon) {
      const w = m.weapons[e.weapon];
      const img = await load(base + w.file);
      const [hx, hy, ang] = m.hands[0];
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate((ang * Math.PI) / 180);
      ctx.drawImage(img, -w.gripX, -w.gripY);
      ctx.restore();
      continue;
    }
    const img = await load(base + m.sheets[e.sheet].file);
    tc.globalCompositeOperation = 'source-over';
    tc.clearRect(0, 0, W, H);
    tc.drawImage(img, 0, 0, W, H, 0, 0, W, H);
    if (e.tint !== 0xffffff) {
      // tinta multiplicada, como no Phaser, preservando a transparência
      tc.globalCompositeOperation = 'multiply';
      tc.fillStyle = hex(e.tint);
      tc.fillRect(0, 0, W, H);
      tc.globalCompositeOperation = 'destination-in';
      tc.drawImage(img, 0, 0, W, H, 0, 0, W, H);
    }
    ctx.drawImage(tmp, 0, 0);
  }
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}
