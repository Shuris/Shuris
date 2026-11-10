// Gerencia a janela única do jogo. O jogo sempre abre em tela cheia; F11 alterna
// para janela (com a moldura normal do sistema, sem barra própria dentro do jogo).
import { app, BrowserWindow, screen, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { IPC, type WindowState } from '../shared/ipc';
import type { Bounds, SettingsStore } from './settingsStore';

const MIN = { width: 960, height: 600 };
const DEFAULT = { width: 1280, height: 800 };

export class WindowManager {
  win: BrowserWindow | null = null;

  constructor(
    private readonly settings: SettingsStore,
    private readonly loadTarget: { url?: string; protocolUrl?: string },
  ) {}

  create(): BrowserWindow {
    const s = this.settings.data;
    const win = new BrowserWindow({
      ...this.ensureVisible(s.bounds),
      minWidth: MIN.width,
      minHeight: MIN.height,
      frame: true,
      autoHideMenuBar: true,
      fullscreen: true,
      show: false,
      backgroundColor: '#1a110c',
      title: 'Colosseum',
      icon: path.join(__dirname, '..', 'renderer', 'assets', 'ui', 'app-icon.png'),
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        spellcheck: false,
        backgroundThrottling: false,
        autoplayPolicy: 'no-user-gesture-required',
      },
    });
    this.win = win;
    win.setMenu(null);
    win.once('ready-to-show', () => {
      if (s.maximized) win.maximize();
      win.setFullScreen(true);
      win.show();
    });

    // Segurança: bloqueia navegação e novas janelas.
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https:\/\//.test(url)) void shell.openExternal(url);
      return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (e, url) => {
      if (!this.isAllowedUrl(url)) e.preventDefault();
    });
    // F11 alterna tela cheia mesmo antes da interface carregar.
    win.webContents.on('before-input-event', (e, input) => {
      if (input.type === 'keyDown' && input.key === 'F11') {
        e.preventDefault();
        this.setFullscreen(!win.isFullScreen());
      }
    });

    // o processo da página caiu ou travou: registra e recarrega (o progresso já está salvo)
    win.webContents.on('render-process-gone', (_e, d) => {
      logCrash(`render-process-gone: ${d.reason} (${d.exitCode})`);
      if (d.reason !== 'clean-exit') setTimeout(() => !win.isDestroyed() && win.reload(), 500);
    });
    win.on('unresponsive', () => logCrash('janela sem resposta'));
    win.webContents.on('console-message', (_e, level, message) => {
      if (level >= 3) logCrash(`erro na página: ${message}`);
    });
    for (const ev of ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen'] as const) {
      win.on(ev as 'maximize', () => this.broadcast());
    }
    const remember = () => this.remember();
    win.on('moved', remember);
    win.on('resized', remember);
    win.on('close', () => {
      this.remember();
      this.settings.save();
    });
    win.on('closed', () => {
      this.win = null;
    });

    void win.loadURL(this.loadTarget.url ?? this.loadTarget.protocolUrl ?? '');
    return win;
  }

  isAllowedUrl(url: string): boolean {
    if (this.loadTarget.url && url.startsWith(this.loadTarget.url)) return true;
    return url.startsWith('app://colosseum/');
  }

  private remember(): void {
    const win = this.win;
    if (!win || win.isDestroyed() || win.isMinimized()) return;
    const s = this.settings.data;
    s.fullscreen = win.isFullScreen();
    if (!s.fullscreen) {
      s.maximized = win.isMaximized();
      if (!win.isMaximized()) s.bounds = win.getBounds();
    }
  }

  /** Garante que a janela apareça em algum monitor (evita janela "perdida"). */
  private ensureVisible(b: Bounds | null): Bounds {
    if (b) {
      const visible = screen.getAllDisplays().some((d) => {
        const wa = d.workArea;
        return b.x + 60 < wa.x + wa.width && b.x + b.width - 60 > wa.x && b.y + 20 < wa.y + wa.height && b.y + 20 > wa.y - 10;
      });
      if (visible) return b;
    }
    const wa = screen.getPrimaryDisplay().workArea;
    const width = Math.min(DEFAULT.width, wa.width);
    const height = Math.min(DEFAULT.height, wa.height);
    return { x: wa.x + Math.round((wa.width - width) / 2), y: wa.y + Math.round((wa.height - height) / 2), width, height };
  }

  setFullscreen(on: boolean): void {
    const win = this.win;
    if (!win || win.isDestroyed()) return;
    win.setFullScreen(on);
    this.settings.data.fullscreen = on;
    this.settings.save();
    this.broadcast();
  }

  state(): WindowState {
    return { maximized: !!this.win?.isMaximized(), fullscreen: !!this.win?.isFullScreen() };
  }

  broadcast(): void {
    if (this.win && !this.win.isDestroyed()) this.win.webContents.send(IPC.evtWindowState, this.state());
  }
}

/** Registro de problemas em userData/logs/colosseum.log (ajuda a investigar travamentos). */
export function logCrash(msg: string): void {
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'colosseum.log');
    if (fs.existsSync(file) && fs.statSync(file).size > 512 * 1024) fs.renameSync(file, `${file}.old`);
    fs.appendFileSync(file, `${new Date().toISOString()} ${msg}\n`);
  } catch {
    /* o registro é opcional */
  }
}
