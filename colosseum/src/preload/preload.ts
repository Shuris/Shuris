// Preload: expõe ao renderer apenas uma API mínima e validada (contextIsolation).
import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type ColosseumBridge, type WindowState } from '../shared/ipc';

const api: ColosseumBridge = {
  save: {
    read: () => ipcRenderer.invoke(IPC.saveRead),
    write: (data: string) => ipcRenderer.invoke(IPC.saveWrite, String(data)),
    writeSync: (data: string) => ipcRenderer.sendSync(IPC.saveWriteSync, String(data)),
    remove: () => ipcRenderer.invoke(IPC.saveDelete),
  },
  win: {
    getState: () => ipcRenderer.invoke(IPC.winGetState),
    setFullscreen: (on: boolean) => ipcRenderer.invoke(IPC.winSetFullscreen, !!on),
    minimize: () => ipcRenderer.send(IPC.winMinimize),
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
