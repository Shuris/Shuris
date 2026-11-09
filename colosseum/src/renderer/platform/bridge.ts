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
  let state: WindowState = {
    mode: 'full', alwaysOnTop: false, opacity: 1, clickThrough: false, maximized: false, opacitySupported: false,
    shortcuts: { clickThrough: 'Ctrl+Shift+X', toggleMode: 'Ctrl+Shift+M', toggleVisible: 'Ctrl+Shift+H' },
    shortcutErrors: [],
  };
  const listeners = new Set<(s: WindowState) => void>();
  const update = (patch: Partial<WindowState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l(state));
    return Promise.resolve(state);
  };
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
      getState: async () => state,
      setMode: (mode) => update({ mode }),
      setAlwaysOnTop: (alwaysOnTop) => update({ alwaysOnTop }),
      setOpacity: (opacity) => update({ opacity }),
      setClickThrough: () => update({ clickThrough: false }),
      minimize: () => undefined,
      hide: () => undefined,
      close: () => window.close(),
      toggleMaximize: () => undefined,
      onState: (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    },
    app: { info: async () => ({ version: 'dev', platform: 'browser', savePath: 'localStorage', isPackaged: false }) },
  };
}

export const bridge: ColosseumBridge = window.colosseum ?? browserFallback();
export const isElectron = !!window.colosseum;
