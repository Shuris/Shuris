// Processo principal do Electron — ponto de entrada do aplicativo desktop.
import { app, BrowserWindow, net, protocol } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerIpc } from './ipcHandlers';
import { SaveStore } from './saveStore';
import { SettingsStore } from './settingsStore';
import { WindowManager } from './windowManager';

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

  app.on('second-instance', () => {
    const w = wm?.win;
    if (!w) return;
    if (w.isMinimized()) w.restore();
    w.show();
    w.focus();
  });

  app.whenReady().then(() => {
    registerAppProtocol();
    const userData = app.getPath('userData');
    const settings = new SettingsStore(userData);
    const saves = new SaveStore(userData);
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    wm = new WindowManager(settings, devUrl ? { url: devUrl } : { protocolUrl: 'app://colosseum/index.html' });
    registerIpc(wm, saves);
    wm.create();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) wm.create();
    });
  });

  app.on('window-all-closed', () => app.quit());
}
