// Contrato de IPC compartilhado entre main, preload e renderer.

export const IPC = {
  saveRead: 'save:read',
  saveWrite: 'save:write',
  saveWriteSync: 'save:write-sync',
  saveDelete: 'save:delete',
  winGetState: 'win:get-state',
  winMinimize: 'win:minimize',
  winClose: 'win:close',
  winToggleMaximize: 'win:toggle-maximize',
  winSetFullscreen: 'win:set-fullscreen',
  appInfo: 'app:info',
  evtWindowState: 'evt:window-state',
} as const;

export interface WindowState {
  maximized: boolean;
  fullscreen: boolean;
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
    setFullscreen(on: boolean): Promise<WindowState>;
    minimize(): void;
    close(): void;
    toggleMaximize(): void;
    onState(cb: (s: WindowState) => void): () => void;
  };
  app: { info(): Promise<AppInfo> };
}

export const MAX_SAVE_BYTES = 5 * 1024 * 1024;
