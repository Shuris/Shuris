// Preferências da janela (modo, posição, sempre no topo, opacidade).
import fs from 'node:fs';
import path from 'node:path';
import type { WindowMode } from '../shared/ipc';
import { MIN_OPACITY } from '../shared/ipc';

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowSettings {
  mode: WindowMode;
  fullBounds: Bounds | null;
  fullMaximized: boolean;
  companionBounds: Bounds | null;
  alwaysOnTop: boolean;
  opacity: number;
}

const DEFAULTS: WindowSettings = {
  mode: 'full',
  fullBounds: null,
  fullMaximized: false,
  companionBounds: null,
  alwaysOnTop: true,
  opacity: 1,
};

function validBounds(b: unknown): Bounds | null {
  if (!b || typeof b !== 'object') return null;
  const o = b as Record<string, unknown>;
  const keys = ['x', 'y', 'width', 'height'] as const;
  if (!keys.every((k) => typeof o[k] === 'number' && Number.isFinite(o[k]))) return null;
  if ((o.width as number) < 100 || (o.height as number) < 100) return null;
  return { x: Math.round(o.x as number), y: Math.round(o.y as number), width: Math.round(o.width as number), height: Math.round(o.height as number) };
}

export class SettingsStore {
  private readonly file: string;
  data: WindowSettings;

  constructor(userData: string) {
    this.file = path.join(userData, 'window-settings.json');
    this.data = this.load();
  }

  private load(): WindowSettings {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Record<string, unknown>;
      return {
        // sempre inicia no modo completo para não "prender" o usuário em uma janela pequena
        mode: 'full',
        fullBounds: validBounds(raw.fullBounds),
        fullMaximized: raw.fullMaximized === true,
        companionBounds: validBounds(raw.companionBounds),
        alwaysOnTop: raw.alwaysOnTop !== false,
        opacity: typeof raw.opacity === 'number' ? Math.min(1, Math.max(MIN_OPACITY, raw.opacity)) : 1,
      };
    } catch {
      return { ...DEFAULTS };
    }
  }

  save(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8');
    } catch {
      /* preferências não são críticas */
    }
  }
}
