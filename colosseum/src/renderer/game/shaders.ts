// "Shaders" do jogo: pós-processamento da câmera (WebGL) aplicado a todas as cenas.
// Gradação de cor quente, um pouco mais de contraste e saturação, e vinheta —
// inspirado no visual pintado de jogos como Dominus Gladiatus, mantendo o pixel art.
import * as Phaser from 'phaser';

export type Look = 'arena' | 'outdoor' | 'indoor' | 'map';

const VIGNETTE: Record<Look, { radius: number; strength: number }> = {
  // bem suave: só um leve escurecimento nos cantos
  arena: { radius: 0.9, strength: 0.1 },
  outdoor: { radius: 0.95, strength: 0.08 },
  indoor: { radius: 0.88, strength: 0.12 },
  map: { radius: 1, strength: 0.06 },
};

const FX_KEY = 'colosseum.fx';

/** Efeitos de imagem ligados? (Opções; desligar ajuda em computadores fracos) */
export function fxEnabled(): boolean {
  try {
    return localStorage.getItem(FX_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setFxEnabled(on: boolean): void {
  try {
    localStorage.setItem(FX_KEY, on ? 'on' : 'off');
  } catch {
    /* preferência opcional */
  }
}

/** Aplica o visual à câmera principal da cena. Devolve a vinheta (para animar). */
export function applyLook(scene: Phaser.Scene, look: Look): { vignette: Phaser.FX.Vignette | null; base: { radius: number; strength: number } } {
  const cam = scene.cameras.main;
  const base = VIGNETTE[look];
  if (!cam.postFX || scene.game.renderer.type !== Phaser.WEBGL) return { vignette: null, base };
  cam.postFX.clear();
  if (!fxEnabled()) return { vignette: null, base };
  const cm = cam.postFX.addColorMatrix();
  // tons quentes (ocre e vermelho realçados, azul contido) como numa pintura
  cm.set([1.07, 0.03, 0, 0, 0, 0.01, 1.0, 0.01, 0, 0, 0, 0.03, 0.9, 0, 0, 0, 0, 0, 1, 0]);
  cm.saturate(look === 'map' ? 0.06 : 0.14, true);
  cm.contrast(look === 'indoor' ? 0.1 : 0.07, true);
  const vignette = cam.postFX.addVignette(0.5, 0.5, base.radius, base.strength);
  return { vignette, base };
}

/** Textura de luz suave (elipse com degradê), criada uma vez. */
export function spotTexture(scene: Phaser.Scene): string {
  const key = 'fx:spot';
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, 256, 128);
  if (!tex) return key;
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(128, 64, 4, 128, 64, 128);
  g.addColorStop(0, 'rgba(255,236,190,0.55)');
  g.addColorStop(0.6, 'rgba(255,220,160,0.18)');
  g.addColorStop(1, 'rgba(255,220,160,0)');
  ctx.save();
  ctx.scale(1, 0.5);
  ctx.translate(0, 64);
  ctx.fillStyle = g;
  ctx.fillRect(0, -64, 256, 256);
  ctx.restore();
  tex.refresh();
  return key;
}

/** Faixa de luz diagonal (raio de sol entrando na arena). */
export function beamTexture(scene: Phaser.Scene): string {
  const key = 'fx:beam';
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, 64, 256);
  if (!tex) return key;
  const ctx = tex.getContext();
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, 'rgba(255,230,180,0)');
  g.addColorStop(0.5, 'rgba(255,230,180,0.5)');
  g.addColorStop(1, 'rgba(255,230,180,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  const fade = ctx.createLinearGradient(0, 0, 0, 256);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 64, 256);
  tex.refresh();
  return key;
}
