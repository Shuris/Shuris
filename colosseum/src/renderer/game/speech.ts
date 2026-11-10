// Balões de fala em pixel art que acompanham um personagem (diálogos e provocações).
import * as Phaser from 'phaser';
import { FONT } from './fx';

export interface Speaker {
  x: number;
  y: number;
}

const active = new WeakMap<Speaker, Phaser.GameObjects.Container>();

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
  const g = scene.add.graphics();
  // balão: borda escura de 1px, fundo claro e "rabicho" apontando para quem fala
  g.fillStyle(0x1a0e08, 1);
  g.fillRoundedRect(-w / 2 - 1, -h - 6, w + 2, h + 2, 3);
  g.fillTriangle(-4, -5, 3, -5, -2, 0);
  g.fillStyle(0xfff6dc, 1);
  g.fillRoundedRect(-w / 2, -h - 5, w, h, 3);
  g.fillTriangle(-3, -5.5, 2, -5.5, -2, -1.5);
  label.setPosition(0, -7);
  const c = scene.add.container(who.x, who.y - head, [g, label]).setDepth(1200).setScale(0.6).setAlpha(0);
  active.set(who, c);
  scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 140, ease: 'Back.easeOut' });
  const follow = () => {
    if (!c.active) return;
    const cam = scene.cameras.main;
    const half = w / 2 + 2;
    // não deixa o balão ficar atrás do painel lateral da interface
    const right = cam.worldView.right - (opts.insetRight?.() ?? 0) / cam.zoom;
    const x = Phaser.Math.Clamp(who.x, cam.worldView.x + half, Math.max(cam.worldView.x + half, right - half));
    c.setPosition(Math.round(x), Math.round(who.y - head));
  };
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
