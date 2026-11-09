// Gerencia a janela única do jogo e a alternância entre os modos
// completo e companion SEM recriar a janela (a batalha continua sem recarregar).
import { BrowserWindow, screen, shell } from 'electron';
import path from 'node:path';
import { IPC, MIN_OPACITY, type WindowMode, type WindowState } from '../shared/ipc';
import type { Bounds, SettingsStore } from './settingsStore';

export const SHORTCUTS = {
  clickThrough: 'CommandOrControl+Shift+X',
  toggleMode: 'CommandOrControl+Shift+M',
  toggleVisible: 'CommandOrControl+Shift+H',
};

const FULL_MIN = { width: 960, height: 600 };
const FULL_DEFAULT = { width: 1280, height: 800 };
const COMP_MIN = { width: 260, height: 180 };
const COMP_DEFAULT = { width: 440, height: 300 };

export class WindowManager {
  win: BrowserWindow | null = null;
  private clickThrough = false;
  shortcutErrors: string[] = [];
  onStateChange: (() => void) | null = null;

  constructor(
    private readonly settings: SettingsStore,
    private readonly loadTarget: { url?: string; protocolUrl?: string },
  ) {}

  get mode(): WindowMode {
    return this.settings.data.mode;
  }

  create(): BrowserWindow {
    const s = this.settings.data;
    const bounds = this.ensureVisible(s.fullBounds, FULL_DEFAULT);
    const win = new BrowserWindow({
      ...bounds,
      minWidth: FULL_MIN.width,
      minHeight: FULL_MIN.height,
      frame: false,
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
      },
    });
    this.win = win;
    win.once('ready-to-show', () => {
      if (s.fullMaximized) win.maximize();
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

    for (const ev of ['maximize', 'unmaximize', 'show', 'hide'] as const) {
      win.on(ev as 'maximize', () => this.broadcast());
    }
    const remember = () => this.rememberBounds();
    win.on('moved', remember);
    win.on('resized', remember);
    win.on('close', () => {
      this.rememberBounds();
      this.settings.save();
    });
    win.on('closed', () => {
      this.win = null;
    });

    if (this.loadTarget.url) void win.loadURL(this.loadTarget.url);
    else if (this.loadTarget.protocolUrl) void win.loadURL(this.loadTarget.protocolUrl);
    return win;
  }

  isAllowedUrl(url: string): boolean {
    if (this.loadTarget.url && url.startsWith(this.loadTarget.url)) return true;
    return url.startsWith('app://colosseum/');
  }

  private rememberBounds(): void {
    const win = this.win;
    if (!win || win.isDestroyed() || win.isMinimized()) return;
    const s = this.settings.data;
    if (s.mode === 'full') {
      s.fullMaximized = win.isMaximized();
      if (!win.isMaximized() && !win.isFullScreen()) s.fullBounds = win.getBounds();
    } else {
      s.companionBounds = win.getBounds();
    }
  }

  /** Garante que a janela apareça em algum monitor (evita janela "perdida"). */
  private ensureVisible(b: Bounds | null, def: { width: number; height: number }, corner = false): Bounds {
    const displays = screen.getAllDisplays();
    if (b) {
      const visible = displays.some((d) => {
        const wa = d.workArea;
        return b.x + 60 < wa.x + wa.width && b.x + b.width - 60 > wa.x && b.y + 20 < wa.y + wa.height && b.y + 20 > wa.y - 10;
      });
      if (visible) return b;
    }
    const wa = screen.getPrimaryDisplay().workArea;
    const width = Math.min(def.width, wa.width);
    const height = Math.min(def.height, wa.height);
    if (corner) return { x: wa.x + wa.width - width - 24, y: wa.y + wa.height - height - 24, width, height };
    return { x: wa.x + Math.round((wa.width - width) / 2), y: wa.y + Math.round((wa.height - height) / 2), width, height };
  }

  setMode(mode: WindowMode): void {
    const win = this.win;
    if (!win || win.isDestroyed()) return;
    const s = this.settings.data;
    if (mode === s.mode) {
      this.broadcast();
      return;
    }
    this.rememberBounds();
    s.mode = mode;
    if (win.isMaximized()) win.unmaximize();
    if (win.isFullScreen()) win.setFullScreen(false);
    if (mode === 'companion') {
      win.setMinimumSize(COMP_MIN.width, COMP_MIN.height);
      win.setBounds(this.ensureVisible(s.companionBounds, COMP_DEFAULT, true));
      win.setAlwaysOnTop(s.alwaysOnTop, 'floating');
      this.applyOpacity();
    } else {
      this.setClickThroughInternal(false);
      win.setAlwaysOnTop(false);
      if (this.opacitySupported) win.setOpacity(1);
      win.setMinimumSize(FULL_MIN.width, FULL_MIN.height);
      win.setBounds(this.ensureVisible(s.fullBounds, FULL_DEFAULT));
      if (s.fullMaximized) win.maximize();
    }
    if (!win.isVisible()) win.show();
    win.focus();
    this.settings.save();
    this.broadcast();
  }

  toggleMode(): void {
    this.setMode(this.mode === 'full' ? 'companion' : 'full');
  }

  setAlwaysOnTop(on: boolean): void {
    this.settings.data.alwaysOnTop = on;
    if (this.win && this.mode === 'companion') this.win.setAlwaysOnTop(on, 'floating');
    this.settings.save();
    this.broadcast();
  }

  get opacitySupported(): boolean {
    return process.platform === 'win32' || process.platform === 'darwin';
  }

  private applyOpacity(): void {
    if (this.win && this.opacitySupported) this.win.setOpacity(this.mode === 'companion' ? this.settings.data.opacity : 1);
  }

  setOpacity(v: number): void {
    if (!Number.isFinite(v)) return;
    this.settings.data.opacity = Math.min(1, Math.max(MIN_OPACITY, v));
    this.applyOpacity();
    this.settings.save();
    this.broadcast();
  }

  private setClickThroughInternal(on: boolean): void {
    this.clickThrough = on;
    if (this.win && !this.win.isDestroyed()) {
      if (on) this.win.setIgnoreMouseEvents(true, { forward: true });
      else this.win.setIgnoreMouseEvents(false);
    }
  }

  /** Clique-através só é permitido no modo companion; sempre reversível por atalho/bandeja. */
  setClickThrough(on: boolean): void {
    this.setClickThroughInternal(on && this.mode === 'companion');
    this.broadcast();
  }

  toggleClickThrough(): void {
    this.setClickThrough(!this.clickThrough);
  }

  get isClickThrough(): boolean {
    return this.clickThrough;
  }

  toggleVisible(): void {
    const win = this.win;
    if (!win) return;
    if (win.isVisible() && !win.isMinimized()) win.hide();
    else this.show();
  }

  show(): void {
    const win = this.win;
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    this.broadcast();
  }

  state(): WindowState {
    const s = this.settings.data;
    return {
      mode: s.mode,
      alwaysOnTop: s.alwaysOnTop,
      opacity: s.opacity,
      clickThrough: this.clickThrough,
      maximized: !!this.win?.isMaximized(),
      opacitySupported: this.opacitySupported,
      shortcuts: {
        clickThrough: 'Ctrl+Shift+X',
        toggleMode: 'Ctrl+Shift+M',
        toggleVisible: 'Ctrl+Shift+H',
      },
      shortcutErrors: this.shortcutErrors,
    };
  }

  broadcast(): void {
    if (this.win && !this.win.isDestroyed()) this.win.webContents.send(IPC.evtWindowState, this.state());
    this.onStateChange?.();
  }
}
