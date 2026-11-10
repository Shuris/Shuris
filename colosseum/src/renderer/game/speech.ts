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
export function speech(scene: Phaser.Scene, who: Speaker, text: string, opts: { head?: number; ms?: number; color?: string; maxW?: number; insetRight?: () => number } = {}): void {
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
  active.set(who, c);
  scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 140, ease: 'Back.easeOut' });
  const follow = () => {
    if (!c.active) return;
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
    box.setPosition(Math.round(off.dx / cam.zoom / s), Math.round(off.dy / cam.zoom / s));
    // empurrado para baixo, o rabicho deixaria de apontar para a boca: esconde
    tail.setVisible(off.dy === 0);
  };
  follow();
  scene.events.on(Phaser.Scenes.Events.UPDATE, follow);
  const done = () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, follow);
    if (active.get(who) === c) active.delete(who);
    c.destroy();
  };
  scene.time.delayedCall(ms, () => {
    if (!c.active) return done();
    scene.tweens.add({ targets: c, alpha: 0, duration: 200, onComplete: done });
  });
  c.once(Phaser.GameObjects.Events.DESTROY, () => scene.events.off(Phaser.Scenes.Events.UPDATE, follow));
}
