// Processo principal do Electron — ponto de entrada do aplicativo desktop.
import { app, BrowserWindow, globalShortcut, net, protocol } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerIpc } from './ipcHandlers';
import { SaveStore } from './saveStore';
import { SettingsStore } from './settingsStore';
import { createTray } from './tray';
import { SHORTCUTS, WindowManager } from './windowManager';

// Permite isolar os dados em testes automatizados.
if (process.env.COLOSSEUM_USER_DATA) app.setPath('userData', path.resolve(process.env.COLOSSEUM_USER_DATA));

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false } },
]);

const RENDERER_DIR = path.join(__dirname, '..', 'renderer');

function registerAppProtocol(): void {
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    if (url.host !== 'colosseum') return new Response('Not found', { status: 404 });
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(RENDERER_DIR, rel));
    if (!file.startsWith(RENDERER_DIR)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let wm: WindowManager;

  app.on('second-instance', () => wm?.show());

  app.whenReady().then(() => {
    registerAppProtocol();
    const userData = app.getPath('userData');
    const settings = new SettingsStore(userData);
    const saves = new SaveStore(userData);
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    wm = new WindowManager(settings, devUrl ? { url: devUrl } : { protocolUrl: 'app://colosseum/index.html' });
    registerIpc(wm, saves);
    wm.create();
    createTray(wm);

    const reg = (accel: string, fn: () => void, label: string) => {
      try {
        if (!globalShortcut.register(accel, fn)) wm.shortcutErrors.push(label);
      } catch {
        wm.shortcutErrors.push(label);
      }
    };
    reg(SHORTCUTS.clickThrough, () => wm.toggleClickThrough(), 'Ctrl+Shift+X');
    reg(SHORTCUTS.toggleMode, () => wm.toggleMode(), 'Ctrl+Shift+M');
    reg(SHORTCUTS.toggleVisible, () => wm.toggleVisible(), 'Ctrl+Shift+H');

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) wm.create();
    });
  });

  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => app.quit());
}
