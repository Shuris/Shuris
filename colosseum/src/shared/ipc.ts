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
  appQuit: 'app:quit',
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
  /** três espaços de salvamento separados (1 a 3) */
  save: {
    read(slot: number): Promise<SaveReadResult>;
    write(slot: number, data: string): Promise<SaveWriteResult>;
    writeSync(slot: number, data: string): SaveWriteResult;
    remove(slot: number): Promise<SaveWriteResult>;
  };
  win: {
    getState(): Promise<WindowState>;
    setFullscreen(on: boolean): Promise<WindowState>;
    minimize(): void;
    close(): void;
    toggleMaximize(): void;
    onState(cb: (s: WindowState) => void): () => void;
  };
  app: { info(): Promise<AppInfo>; quit(): void };
}

export const MAX_SAVE_BYTES = 5 * 1024 * 1024;
export const SAVE_SLOTS = [1, 2, 3] as const;

export function isSlot(v: unknown): v is number {
  return typeof v === 'number' && (SAVE_SLOTS as readonly number[]).includes(v);
}
