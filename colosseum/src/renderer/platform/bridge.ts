// Acesso à API do Electron exposta pelo preload, com alternativa para rodar
// no navegador durante o desenvolvimento (salva em localStorage).
import type { ColosseumBridge, WindowState } from '../../shared/ipc';

declare global {
  interface Window {
    colosseum?: ColosseumBridge;
  }
}

const LS_KEY = 'colosseum.save';

function browserFallback(): ColosseumBridge {
  const listeners = new Set<(s: WindowState) => void>();
  const state = (): WindowState => ({ maximized: false, fullscreen: !!document.fullscreenElement });
  document.addEventListener('fullscreenchange', () => listeners.forEach((l) => l(state())));
  const write = (data: string) => {
    try {
      localStorage.setItem(LS_KEY, data);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  };
  return {
    save: {
      read: async () => {
        const data = localStorage.getItem(LS_KEY);
        return { ok: true, data, source: data ? 'primary' : 'none' };
      },
      write: async (d) => write(d),
      writeSync: (d) => write(d),
      remove: async () => (localStorage.removeItem(LS_KEY), { ok: true }),
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
    app: { info: async () => ({ version: 'dev', platform: 'browser', savePath: 'localStorage', isPackaged: false }) },
  };
}

export const bridge: ColosseumBridge = window.colosseum ?? browserFallback();
export const isElectron = !!window.colosseum;
