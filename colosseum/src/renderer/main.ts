// Ponto de entrada do renderer.
import '@fontsource/vt323/400.css';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import './styles/main.css';
import { App } from './ui/App';

async function boot() {
  // garante as fontes pixel antes de criar textos no canvas
  try {
    await Promise.all([document.fonts.load('16px VT323'), document.fonts.load('16px "Pixelify Sans"')]);
  } catch {
    /* segue com fonte padrão */
  }
  const app = new App(document.getElementById('app') as HTMLElement);
  await app.init();
}

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('app');
  if (el) el.innerHTML = `<div class="fatal">Erro ao iniciar o jogo: ${String(err?.message ?? err).replace(/[<>&]/g, '')}</div>`;
});
