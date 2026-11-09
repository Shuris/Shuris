// Contrato de IPC compartilhado entre main, preload e renderer.

export const IPC = {
  saveRead: 'save:read',
  saveWrite: 'save:write',
  saveWriteSync: 'save:write-sync',
  saveDelete: 'save:delete',
  winGetState: 'win:get-state',
  winSetMode: 'win:set-mode',
  winSetAlwaysOnTop: 'win:set-always-on-top',
  winSetOpacity: 'win:set-opacity',
  winSetClickThrough: 'win:set-click-through',
  winMinimize: 'win:minimize',
  winHide: 'win:hide',
  winClose: 'win:close',
  winToggleMaximize: 'win:toggle-maximize',
  appInfo: 'app:info',
  evtWindowState: 'evt:window-state',
} as const;

export type WindowMode = 'full' | 'companion';

export interface WindowState {
  mode: WindowMode;
  alwaysOnTop: boolean;
  opacity: number;
  clickThrough: boolean;
  maximized: boolean;
  opacitySupported: boolean;
  shortcuts: { clickThrough: string; toggleMode: string; toggleVisible: string };
  shortcutErrors: string[];
}

export interface SaveReadResult {
  ok: boolean;
  data: string | null;
  source: 'primary' | 'backup' | 'none';
  error?: string;
}

export interface SaveWriteResult {
  ok: boolean;
  error?: string;
}

export interface AppInfo {
  version: string;
  platform: string;
  savePath: string;
  isPackaged: boolean;
}

/** API exposta ao renderer via contextBridge (window.colosseum). */
export interface ColosseumBridge {
  save: {
    read(): Promise<SaveReadResult>;
    write(data: string): Promise<SaveWriteResult>;
    writeSync(data: string): SaveWriteResult;
    remove(): Promise<SaveWriteResult>;
  };
  win: {
    getState(): Promise<WindowState>;
    setMode(mode: WindowMode): Promise<WindowState>;
    setAlwaysOnTop(on: boolean): Promise<WindowState>;
    setOpacity(value: number): Promise<WindowState>;
    setClickThrough(on: boolean): Promise<WindowState>;
    minimize(): void;
    hide(): void;
    close(): void;
    toggleMaximize(): void;
    onState(cb: (s: WindowState) => void): () => void;
  };
  app: { info(): Promise<AppInfo> };
}

export const MAX_SAVE_BYTES = 5 * 1024 * 1024;
export const MIN_OPACITY = 0.3;
