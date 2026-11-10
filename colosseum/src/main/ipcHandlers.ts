// Handlers de IPC: validam remetente e argumentos antes de agir.
import { app, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { IPC, isSlot } from '../shared/ipc';
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

  const slotOf = (v: unknown) => (isSlot(v) ? v : 0);
  ipcMain.handle(IPC.saveRead, guard((slot: unknown) => saves.read(slotOf(slot))));
  ipcMain.handle(IPC.saveWrite, guard((slot: unknown, data: unknown) => (typeof data === 'string' ? saves.write(slotOf(slot), data) : { ok: false, error: 'tipo inválido' })));
  ipcMain.handle(IPC.saveDelete, guard((slot: unknown) => saves.remove(slotOf(slot))));
  ipcMain.on(IPC.saveWriteSync, (e, slot: unknown, data: unknown) => {
    e.returnValue = trusted(e) && typeof data === 'string' ? saves.write(slotOf(slot), data) : { ok: false, error: 'não autorizado' };
  });

  ipcMain.handle(IPC.winGetState, guard(() => wm.state()));
  ipcMain.handle(IPC.winSetFullscreen, guard((on: unknown) => (wm.setFullscreen(on === true), wm.state())));
  ipcMain.handle(
    IPC.appInfo,
    guard(() => ({ version: app.getVersion(), platform: process.platform, savePath: saves.dir, isPackaged: app.isPackaged })),
  );

  const onWin = (channel: string, fn: () => void) =>
    ipcMain.on(channel, (e) => {
      if (trusted(e)) fn();
    });
  onWin(IPC.winMinimize, () => wm.win?.minimize());
  onWin(IPC.winClose, () => wm.win?.close());
  onWin(IPC.appQuit, () => app.quit());
  onWin(IPC.winToggleMaximize, () => {
    const w = wm.win;
    if (!w || w.isFullScreen()) return;
    if (w.isMaximized()) w.unmaximize();
    else w.maximize();
  });
}
