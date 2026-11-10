// Minijogo da queda de braço (taverna, domingo à noite): um marcador corre de um
// lado para o outro; apertar no momento em que ele está na faixa dourada empurra
// o braço do adversário. Errar devolve terreno. O adversário puxa sem parar.
import { esc } from '../dom';
import { t } from '../../i18n';
import { sound } from '../../audio/SoundManager';
import { closeModal, openModal } from './feedback';

export interface ArmSetup {
  zone: number;
  push: number;
  pull: number;
  champion: string;
}

/** Abre o minijogo e resolve com true (vitória) ou false (derrota/desistência). */
export function playArmWrestle(setup: ArmSetup, playerName: string): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    let pos = 50; // 0 = perdeu, 100 = venceu
    let marker = 0;
    let dir = 1;
    let last = performance.now();
    let started = false;
    let lastPress = 0;
    let raf = 0;
    const zoneStart = 0.5 - setup.zone / 2;
    const m = openModal(
      `<h2 class="center">${t('event.armTitle')}</h2>
      <p class="center tiny dim">${t('event.armHow')}</p>
      <div class="arm-names"><b>${esc(playerName)}</b><b>${esc(setup.champion)}</b></div>
      <div class="arm-rope"><div class="arm-fill" data-fill></div><div class="arm-knot" data-knot></div></div>
      <div class="arm-meter"><div class="arm-zone" style="left:${(zoneStart * 100).toFixed(1)}%;width:${(setup.zone * 100).toFixed(1)}%"></div><div class="arm-marker" data-marker></div></div>
      <p class="center arm-msg" data-msg>${t('event.armReady')}</p>
      <div class="row center"><button class="btn btn-red btn-big" data-arm="push">${t('event.armPush')}</button></div>`,
      { cls: 'modal-arm', dismissable: false, onClose: () => finish(false) },
    );
    const fill = m.querySelector('[data-fill]') as HTMLElement;
    const knot = m.querySelector('[data-knot]') as HTMLElement;
    const mk = m.querySelector('[data-marker]') as HTMLElement;
    const msg = m.querySelector('[data-msg]') as HTMLElement;
    const draw = () => {
      fill.style.width = `${pos}%`;
      knot.style.left = `${pos}%`;
      mk.style.left = `${(marker * 100).toFixed(1)}%`;
    };
    const finish = (won: boolean) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      resolve(won);
    };
    const end = (won: boolean) => {
      msg.textContent = won ? t('event.armWin') : t('event.armLose');
      msg.className = `center arm-msg ${won ? 'gold' : 'red'}`;
      sound.play(won ? 'victory' : 'defeat');
      (m.querySelector('[data-arm="push"]') as HTMLButtonElement).disabled = true;
      finish(won);
      setTimeout(() => closeModal(), 1600);
    };
    const press = () => {
      if (done) return;
      if (!started) {
        started = true;
        msg.textContent = t('event.armGo');
        last = performance.now();
        raf = requestAnimationFrame(loop);
        return;
      }
      // um empurrão por vez: apertar sem parar não adianta
      const now = performance.now();
      if (now - lastPress < 220) return;
      lastPress = now;
      const inZone = marker >= zoneStart && marker <= zoneStart + setup.zone;
      pos = Math.max(0, Math.min(100, pos + (inZone ? setup.push : -setup.push * 0.5)));
      sound.play(inZone ? 'hit' : 'error', inZone ? 0.6 : 1);
      msg.textContent = inZone ? t('event.armGood') : t('event.armMiss');
      draw();
      if (pos >= 100) end(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        press();
      }
    };
    const loop = (now: number) => {
      if (done) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      marker += dir * dt * 1.25;
      if (marker > 1) (marker = 1), (dir = -1);
      if (marker < 0) (marker = 0), (dir = 1);
      pos -= setup.pull * dt * 1.4;
      draw();
      if (pos <= 0) return end(false);
      raf = requestAnimationFrame(loop);
    };
    m.querySelector('[data-arm="push"]')?.addEventListener('click', press);
    window.addEventListener('keydown', onKey);
    draw();
  });
}
