// Efeitos visuais simples: textos flutuantes, faíscas e poeira em pixel art.
import * as Phaser from 'phaser';

export const FONT = 'VT323, monospace';

export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color: string, size = 11, rise = 18, life = 900): void {
  const zoom = scene.cameras.main.zoom;
  const t = scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#1a0e08', strokeThickness: 3 })
    .setOrigin(0.5, 1)
    .setDepth(1000)
    .setResolution(Math.max(1, Math.ceil(zoom * (window.devicePixelRatio || 1))));
  scene.tweens.add({
    targets: t,
    y: y - rise,
    alpha: { from: 1, to: 0 },
    ease: 'Cubic.easeOut',
    duration: life,
    onComplete: () => t.destroy(),
  });
}

export function bigText(scene: Phaser.Scene, x: number, y: number, text: string, color = '#ffd36a', size = 28): void {
  const zoom = scene.cameras.main.zoom;
  const t = scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#2a120a', strokeThickness: 5 })
    .setOrigin(0.5)
    .setDepth(1001)
    .setScale(0.4)
    .setResolution(Math.max(1, Math.ceil(zoom * (window.devicePixelRatio || 1))));
  scene.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: t, alpha: 0, delay: 1000, duration: 400, onComplete: () => t.destroy() });
}

export function sparks(scene: Phaser.Scene, x: number, y: number, color: number, count = 6): void {
  for (let i = 0; i < count; i++) {
    const p = scene.add.rectangle(x, y, 2, 2, color).setDepth(900);
    const a = Math.random() * Math.PI * 2;
    const d = 6 + Math.random() * 12;
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(a) * d,
      y: y + Math.sin(a) * d - 4,
      alpha: 0,
      duration: 260 + Math.random() * 200,
      onComplete: () => p.destroy(),
    });
  }
}

export function dust(scene: Phaser.Scene, x: number, y: number, count = 3): void {
  for (let i = 0; i < count; i++) {
    const p = scene.add.rectangle(x + (Math.random() - 0.5) * 10, y - 1, 2, 2, 0xc9a666, 0.9).setDepth(5);
    scene.tweens.add({
      targets: p,
      y: p.y - 3 - Math.random() * 4,
      x: p.x + (Math.random() - 0.5) * 8,
      alpha: 0,
      duration: 400 + Math.random() * 300,
      onComplete: () => p.destroy(),
    });
  }
}
