// Retratos em pixel art (adversários, moradores e o próprio gladiador).
// Os retratos fixos vêm de assets/portraits/<id>.png; o do jogador é montado em
// camadas (pele, cabelo tingido, barba, capacete) num canvas e guardado em cache.
import type { Appearance } from '../../core/model/types';
import { HAIR_COLORS } from '../../core/data/gladiators';
import { esc } from '../dom';

export type PortraitSize = 'sm' | 'md' | 'lg' | 'xl';

export function portraitSrc(id: string): string {
  return `assets/portraits/${id}.png`;
}

export function portrait(id: string, size: PortraitSize = 'md', src?: string): string {
  return `<span class="portrait portrait-${size}"><img src="${esc(src ?? portraitSrc(id))}" alt="" draggable="false"></span>`;
}

const cache = new Map<string, string>();
const images = new Map<string, Promise<HTMLImageElement>>();

function loadImg(src: string): Promise<HTMLImageElement> {
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

/** Camadas do retrato do jogador, na ordem de desenho. */
export function playerPortraitLayers(a: Appearance, helmet: string | null): Array<{ src: string; tint?: number }> {
  const hair = HAIR_COLORS[a.hairColor] ?? 0xffffff;
  const out: Array<{ src: string; tint?: number }> = [{ src: portraitSrc(`layer_base_${a.skin}`) }];
  if (a.beard) out.push({ src: portraitSrc('layer_beard'), tint: hair });
  if (helmet) out.push({ src: portraitSrc(`layer_helmet_${helmet}`) });
  else out.push({ src: portraitSrc(`layer_hair_${a.hairStyle}`), tint: hair });
  return out;
}

/** Retrato do jogador como data URL (assíncrono; usa cache). */
export async function playerPortrait(a: Appearance, helmet: string | null): Promise<string> {
  const key = `${a.skin}|${a.hairStyle}|${a.hairColor}|${a.beard}|${helmet}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const layers = playerPortraitLayers(a, helmet);
  const imgs = await Promise.all(layers.map((l) => loadImg(l.src)));
  const w = imgs[0].width;
  const h = imgs[0].height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d')!;
  layers.forEach((l, i) => {
    if (l.tint === undefined) return ctx.drawImage(imgs[i], 0, 0);
    // tinta multiplicativa (como no Phaser), preservando a transparência
    tctx.clearRect(0, 0, w, h);
    tctx.globalCompositeOperation = 'source-over';
    tctx.drawImage(imgs[i], 0, 0);
    tctx.globalCompositeOperation = 'multiply';
    tctx.fillStyle = `#${l.tint.toString(16).padStart(6, '0')}`;
    tctx.fillRect(0, 0, w, h);
    tctx.globalCompositeOperation = 'destination-in';
    tctx.drawImage(imgs[i], 0, 0);
    ctx.drawImage(tmp, 0, 0);
  });
  const url = canvas.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
