// Carregamento de assets orientado por manifesto (permite trocar a arte sem mexer no código).
import type * as Phaser from 'phaser';

export interface AnimDef {
  start: number;
  count: number;
  fps: number;
  loop: boolean;
}

export interface GladiatorManifest {
  frameWidth: number;
  frameHeight: number;
  originX: number;
  originY: number;
  frameCount: number;
  animations: Record<string, AnimDef>;
  layerOrder: string[];
  sheets: Record<string, { file: string; layer: string }>;
}

export const MANIFEST_KEY = 'gladiator-manifest';
export const WORLD = { width: 640, height: 360 };

export function getManifest(scene: Phaser.Scene): GladiatorManifest {
  return scene.cache.json.get(MANIFEST_KEY) as GladiatorManifest;
}

export function sheetKey(name: string): string {
  return `gl:${name}`;
}

export function queueGladiatorSheets(scene: Phaser.Scene, m: GladiatorManifest): void {
  for (const [name, def] of Object.entries(m.sheets)) {
    scene.load.spritesheet(sheetKey(name), `assets/${def.file}`, { frameWidth: m.frameWidth, frameHeight: m.frameHeight });
  }
}
