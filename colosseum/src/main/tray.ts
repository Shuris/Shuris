// Ícone na bandeja: caminho sempre disponível para restaurar a janela,
// desativar o clique-através ou sair, mesmo que a janela não responda a cliques.
import { app, Menu, nativeImage, Tray } from 'electron';
import path from 'node:path';
import type { WindowManager } from './windowManager';

export function createTray(wm: WindowManager): Tray | null {
  try {
    const iconPath = path.join(__dirname, '..', 'renderer', 'assets', 'ui', 'app-icon.png');
    const image = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16, quality: 'good' });
    const tray = new Tray(image);
    tray.setToolTip('Colosseum');
    const rebuild = () => {
      const s = wm.state();
      tray.setContextMenu(
        Menu.buildFromTemplate([
          { label: 'Mostrar Colosseum', click: () => wm.show() },
          { label: s.mode === 'full' ? 'Modo companion' : 'Modo completo', accelerator: 'CmdOrCtrl+Shift+M', click: () => wm.toggleMode() },
          { type: 'separator' },
          { label: 'Sempre no topo (companion)', type: 'checkbox', checked: s.alwaysOnTop, click: (i) => wm.setAlwaysOnTop(i.checked) },
          {
            label: 'Ignorar cliques (clique-através)',
            type: 'checkbox',
            checked: s.clickThrough,
            enabled: s.mode === 'companion',
            accelerator: 'CmdOrCtrl+Shift+X',
            click: (i) => wm.setClickThrough(i.checked),
          },
          { type: 'separator' },
          { label: 'Sair', click: () => app.quit() },
        ]),
      );
    };
    rebuild();
    wm.onStateChange = rebuild;
    tray.on('click', () => wm.show());
    return tray;
  } catch {
    return null;
  }
}
