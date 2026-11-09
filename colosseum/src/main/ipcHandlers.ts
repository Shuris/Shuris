// Handlers de IPC: validam remetente e argumentos antes de agir.
import { app, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { IPC, type WindowMode } from '../shared/ipc';
import type { SaveStore } from './saveStore';
import type { WindowManager } from './windowManager';

export function registerIpc(wm: WindowManager, saves: SaveStore): void {
  const trusted = (e: IpcMainEvent | IpcMainInvokeEvent): boolean => {
    const url = e.senderFrame?.url ?? '';
    return !!wm.win && e.sender.id === wm.win.webContents.id && wm.isAllowedUrl(url);
  };
  const guard =
    <A extends unknown[], R>(fn: (...args: A) => R) =>
    (e: IpcMainInvokeEvent, ...args: A): R => {
      if (!trusted(e)) throw new Error('Remetente IPC não autorizado.');
      return fn(...args);
    };

  ipcMain.handle(IPC.saveRead, guard(() => saves.read()));
  ipcMain.handle(IPC.saveWrite, guard((data: unknown) => (typeof data === 'string' ? saves.write(data) : { ok: false, error: 'tipo inválido' })));
  ipcMain.handle(IPC.saveDelete, guard(() => saves.remove()));
  ipcMain.on(IPC.saveWriteSync, (e, data: unknown) => {
    e.returnValue = trusted(e) && typeof data === 'string' ? saves.write(data) : { ok: false, error: 'não autorizado' };
  });

  ipcMain.handle(IPC.winGetState, guard(() => wm.state()));
  ipcMain.handle(
    IPC.winSetMode,
    guard((mode: unknown) => {
      if (mode === 'full' || mode === 'companion') wm.setMode(mode as WindowMode);
      return wm.state();
    }),
  );
  ipcMain.handle(IPC.winSetAlwaysOnTop, guard((on: unknown) => (wm.setAlwaysOnTop(on === true), wm.state())));
  ipcMain.handle(IPC.winSetOpacity, guard((v: unknown) => (typeof v === 'number' && wm.setOpacity(v), wm.state())));
  ipcMain.handle(IPC.winSetClickThrough, guard((on: unknown) => (wm.setClickThrough(on === true), wm.state())));
  ipcMain.handle(
    IPC.appInfo,
    guard(() => ({ version: app.getVersion(), platform: process.platform, savePath: saves.file, isPackaged: app.isPackaged })),
  );

  const onWin = (channel: string, fn: () => void) =>
    ipcMain.on(channel, (e) => {
      if (trusted(e)) fn();
    });
  onWin(IPC.winMinimize, () => wm.win?.minimize());
  onWin(IPC.winHide, () => wm.win?.hide());
  onWin(IPC.winClose, () => wm.win?.close());
  onWin(IPC.winToggleMaximize, () => {
    const w = wm.win;
    if (!w || wm.mode !== 'full') return;
    if (w.isMaximized()) w.unmaximize();
    else w.maximize();
  });
}
