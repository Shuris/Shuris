// Acesso à API do Electron exposta pelo preload, com alternativa para rodar
// no navegador durante o desenvolvimento (salva em localStorage).
import type { ColosseumBridge, WindowState } from '../../shared/ipc';

declare global {
  interface Window {
    colosseum?: ColosseumBridge;
  }
}

const LS_KEY = (slot: number) => `colosseum.save.${slot}`;

function browserFallback(): ColosseumBridge {
  const listeners = new Set<(s: WindowState) => void>();
  const state = (): WindowState => ({ maximized: false, fullscreen: !!document.fullscreenElement });
  document.addEventListener('fullscreenchange', () => listeners.forEach((l) => l(state())));
  const write = (slot: number, data: string) => {
    try {
      localStorage.setItem(LS_KEY(slot), data);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  };
  return {
    save: {
      read: async (slot) => {
        const data = localStorage.getItem(LS_KEY(slot)) ?? (slot === 1 ? localStorage.getItem('colosseum.save') : null);
        return { ok: true, data, source: data ? 'primary' : 'none' };
      },
      write: async (slot, d) => write(slot, d),
      writeSync: (slot, d) => write(slot, d),
      remove: async (slot) => (localStorage.removeItem(LS_KEY(slot)), slot === 1 && localStorage.removeItem('colosseum.save'), { ok: true }),
    },
    win: {
      getState: async () => state(),
      setFullscreen: async (on) => {
        try {
          if (on) await document.documentElement.requestFullscreen();
          else if (document.fullscreenElement) await document.exitFullscreen();
        } catch {
          /* ignorado */
        }
        return state();
      },
      minimize: () => undefined,
      close: () => window.close(),
      toggleMaximize: () => undefined,
      onState: (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    },
    app: { info: async () => ({ version: 'dev', platform: 'browser', savePath: 'localStorage', isPackaged: false }), quit: () => window.close() },
  };
}

export const bridge: ColosseumBridge = window.colosseum ?? browserFallback();
export const isElectron = !!window.colosseum;
