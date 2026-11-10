// Preload: expõe ao renderer apenas uma API mínima e validada (contextIsolation).
import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type ColosseumBridge, type WindowState } from '../shared/ipc';

const api: ColosseumBridge = {
  save: {
    read: (slot: number) => ipcRenderer.invoke(IPC.saveRead, Number(slot)),
    write: (slot: number, data: string) => ipcRenderer.invoke(IPC.saveWrite, Number(slot), String(data)),
    writeSync: (slot: number, data: string) => ipcRenderer.sendSync(IPC.saveWriteSync, Number(slot), String(data)),
    remove: (slot: number) => ipcRenderer.invoke(IPC.saveDelete, Number(slot)),
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
  app: { info: () => ipcRenderer.invoke(IPC.appInfo), quit: () => ipcRenderer.send(IPC.appQuit) },
};

contextBridge.exposeInMainWorld('colosseum', api);
