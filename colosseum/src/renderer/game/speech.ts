// Balões de fala em pixel art que acompanham um personagem (diálogos e provocações).
// O balão nunca fica escondido atrás da interface HTML (status, painel lateral, HUD da
// luta, avisos): se encostar numa dessas janelas, ele desliza para o lado ou para baixo.
import * as Phaser from 'phaser';
import { FONT } from './fx';
import { avoidOffset } from './avoid';

export interface Speaker {
  x: number;
  y: number;
}

const active = new WeakMap<Speaker, Phaser.GameObjects.Container>();

/** Balões visíveis (retângulo no mundo), para um não cobrir o outro. */
interface Placed {
  scene: Phaser.Scene;
  id: number;
  rect: { x: number; y: number; w: number; h: number } | null;
}
const placed = new Set<Placed>();
let nextId = 0;

/** Retângulos (em pixels da tela) das janelas da interface que o balão deve evitar. */
let obstacles: () => DOMRect[] = () => [];
let cache: { at: number; rects: DOMRect[] } = { at: -1, rects: [] };

export function setSpeechObstacles(fn: () => DOMRect[]): void {
  obstacles = fn;
  cache = { at: -1, rects: [] };
}

function obstacleRects(): DOMRect[] {
  const now = performance.now();
  if (now - cache.at > 150) cache = { at: now, rects: obstacles().filter((r) => r.width > 0 && r.height > 0) };
  return cache.rects;
}

/**
 * Mostra um balão acima de `who` (posição dos pés) por `ms` milissegundos.
 * @param head altura da cabeça acima dos pés (px do mundo)
 */
export function speech(
  scene: Phaser.Scene,
  who: Speaker,
  text: string,
  opts: { head?: number; ms?: number; color?: string; maxW?: number; insetRight?: () => number } = {},
): void {
  const head = opts.head ?? 50;
  const ms = opts.ms ?? Math.min(5200, 1800 + text.length * 45);
  active.get(who)?.destroy();
  const zoom = scene.cameras.main.zoom;
  const res = Math.max(4, Math.ceil(zoom * (window.devicePixelRatio || 1)));
  const label = scene.add
    .text(0, 0, text, { fontFamily: FONT, fontSize: '8px', color: opts.color ?? '#2a1a10', wordWrap: { width: opts.maxW ?? 120 }, align: 'center', lineSpacing: -2 })
    .setOrigin(0.5, 1)
    .setResolution(res);
  const w = Math.ceil(label.width) + 8;
  const h = Math.ceil(label.height) + 5;
  // caixa (pode deslizar) e rabicho (sempre apontando para quem fala)
  const boxG = scene.add.graphics();
  boxG.fillStyle(0x1a0e08, 1);
  boxG.fillRoundedRect(-w / 2 - 1, -h - 6, w + 2, h + 2, 3);
  boxG.fillStyle(0xfff6dc, 1);
  boxG.fillRoundedRect(-w / 2, -h - 5, w, h, 3);
  label.setPosition(0, -7);
  const box = scene.add.container(0, 0, [boxG, label]);
  const tail = scene.add.graphics();
  tail.fillStyle(0x1a0e08, 1);
  tail.fillTriangle(-4, -5, 3, -5, -2, 0);
  tail.fillStyle(0xfff6dc, 1);
  tail.fillTriangle(-3, -5.5, 2, -5.5, -2, -1.5);
  const c = scene.add.container(who.x, who.y - head, [tail, box]).setDepth(1200).setScale(0.6).setAlpha(0);
  const me: Placed = { scene, id: nextId++, rect: null };
  placed.add(me);
  active.set(who, c);
  scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 140, ease: 'Back.easeOut' });
  const follow = () => {
    if (!c.active) return;
    if ((who as { active?: boolean }).active === false) return done();
    const cam = scene.cameras.main;
    const half = w / 2 + 2;
    const right = cam.worldView.right - (opts.insetRight?.() ?? 0) / cam.zoom;
    const x = Phaser.Math.Clamp(who.x, cam.worldView.x + half, Math.max(cam.worldView.x + half, right - half));
    const y = who.y - head;
    c.setPosition(Math.round(x), Math.round(y));
    // desvia das janelas da interface (convertendo o balão para pixels da tela)
    const canvas = scene.game.canvas.getBoundingClientRect();
    const toScreenX = (wx: number) => canvas.left + (wx - cam.worldView.x) * cam.zoom;
    const toScreenY = (wy: number) => canvas.top + (wy - cam.worldView.y) * cam.zoom;
    const s = c.scale;
    const boxScreen = { left: toScreenX(x - (w / 2 + 1) * s), right: toScreenX(x + (w / 2 + 1) * s), top: toScreenY(y - (h + 6) * s), bottom: toScreenY(y - 4 * s) };
    const off = avoidOffset(boxScreen, obstacleRects(), { left: canvas.left, right: canvas.right, bottom: canvas.bottom });
    const bx = Math.round(off.dx / cam.zoom / s);
    let by = Math.round(off.dy / cam.zoom / s);
    // não cobre um balão mais antigo: sobe acima dele
    const bw = w + 2;
    const bh = h + 2;
    for (let k = 0; k < 3; k++) {
      const left = x + (bx - bw / 2) * s;
      const top = y + (by - h - 6) * s;
      const hit = [...placed].find(
        (o) => o !== me && o.scene === scene && o.id < me.id && o.rect && left < o.rect.x + o.rect.w && left + bw * s > o.rect.x && top < o.rect.y + o.rect.h && top + bh * s > o.rect.y,
      );
      if (!hit?.rect) break;
      by -= Math.ceil((top + bh * s - hit.rect.y) / s) + 2;
    }
    box.setPosition(bx, by);
    me.rect = { x: x + (bx - bw / 2) * s, y: y + (by - h - 6) * s, w: bw * s, h: bh * s };
    // empurrado, o rabicho deixaria de apontar para a boca: esconde
    tail.setVisible(off.dy === 0 && by === Math.round(off.dy / cam.zoom / s));
  };
  follow();
  scene.events.on(Phaser.Scenes.Events.UPDATE, follow);
  const done = () => {
    placed.delete(me);
    scene.events.off(Phaser.Scenes.Events.UPDATE, follow);
    if (active.get(who) === c) active.delete(who);
    c.destroy();
  };
  scene.time.delayedCall(ms, () => {
    if (!c.active) return done();
    scene.tweens.add({ targets: c, alpha: 0, duration: 200, onComplete: done });
  });
  c.once(Phaser.GameObjects.Events.DESTROY, () => {
    placed.delete(me);
    scene.events.off(Phaser.Scenes.Events.UPDATE, follow);
  });
}
