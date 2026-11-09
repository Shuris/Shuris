// Preload: expõe ao renderer apenas uma API mínima e validada (contextIsolation).
import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type ColosseumBridge, type WindowMode, type WindowState } from '../shared/ipc';

const api: ColosseumBridge = {
  save: {
    read: () => ipcRenderer.invoke(IPC.saveRead),
    write: (data: string) => ipcRenderer.invoke(IPC.saveWrite, String(data)),
    writeSync: (data: string) => ipcRenderer.sendSync(IPC.saveWriteSync, String(data)),
    remove: () => ipcRenderer.invoke(IPC.saveDelete),
  },
  win: {
    getState: () => ipcRenderer.invoke(IPC.winGetState),
    setMode: (mode: WindowMode) => ipcRenderer.invoke(IPC.winSetMode, mode),
    setAlwaysOnTop: (on: boolean) => ipcRenderer.invoke(IPC.winSetAlwaysOnTop, !!on),
    setOpacity: (value: number) => ipcRenderer.invoke(IPC.winSetOpacity, Number(value)),
    setClickThrough: (on: boolean) => ipcRenderer.invoke(IPC.winSetClickThrough, !!on),
    minimize: () => ipcRenderer.send(IPC.winMinimize),
    hide: () => ipcRenderer.send(IPC.winHide),
    close: () => ipcRenderer.send(IPC.winClose),
    toggleMaximize: () => ipcRenderer.send(IPC.winToggleMaximize),
    onState: (cb: (s: WindowState) => void) => {
      const listener = (_e: unknown, s: WindowState) => cb(s);
      ipcRenderer.on(IPC.evtWindowState, listener);
      return () => ipcRenderer.removeListener(IPC.evtWindowState, listener);
    },
  },
  app: { info: () => ipcRenderer.invoke(IPC.appInfo) },
};

contextBridge.exposeInMainWorld('colosseum', api);
