// Preferências da janela (posição, tamanho, maximizada, tela cheia).
import fs from 'node:fs';
import path from 'node:path';

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowSettings {
  bounds: Bounds | null;
  maximized: boolean;
  fullscreen: boolean;
}

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
        bounds: validBounds(raw.bounds ?? raw.fullBounds),
        maximized: raw.maximized === true || raw.fullMaximized === true,
        fullscreen: raw.fullscreen === true,
      };
    } catch {
      return { bounds: null, maximized: false, fullscreen: false };
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
