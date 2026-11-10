// Enquadramento de câmera responsivo: funciona em qualquer tamanho de janela.
import type * as Phaser from 'phaser';
import { WORLD } from './assets';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Insets {
  right: number;
  top: number;
  bottom: number;
}

/**
 * Calcula zoom e centro para que `focus` caiba na área livre (descontando insets),
 * sem mostrar mais do que o necessário do mundo quando houver espaço sobrando.
 */
export function frameCamera(cam: Phaser.Cameras.Scene2D.Camera, focus: Rect, insets: Insets, center: { x: number; y: number }, maxZoom = 6, cover = true): void {
  const vw = Math.max(1, cam.width - insets.right);
  const vh = Math.max(1, cam.height - insets.top - insets.bottom);
  const fit = Math.min(vw / focus.w, vh / focus.h);
  // nunca menor que o necessário para cobrir o mundo inteiro (evita bordas vazias)
  const coverZoom = Math.max(cam.width / WORLD.width, cam.height / WORLD.height);
  const zoom = Math.min(maxZoom, cover ? Math.max(fit, coverZoom) : fit);
  cam.setZoom(zoom);
  // desloca o centro para compensar áreas cobertas pela interface
  const ox = insets.right / 2 / zoom;
  const oy = (insets.top - insets.bottom) / 2 / zoom;
  cam.centerOn(center.x + ox, center.y - oy);
}
