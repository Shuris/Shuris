// HUD da batalha (HTML sobre o canvas): barras de vida/resistência, tempo e narração.
import type { CombatEngine } from '../../core/combat/CombatEngine';
import type { CombatEvent, FighterState } from '../../core/combat/CombatTypes';
import { SKILLS } from '../../core/data/skills';
import { esc, fmtDuration } from '../dom';

export interface HudCallbacks {
  onSpeed(s: number): void;
  onForfeit(): void;
}

export class BattleHud {
  private root: HTMLElement;
  private log: string[] = [];
  private lastTime = '';

  constructor(root: HTMLElement, private readonly cb: HudCallbacks) {
    this.root = root;
    root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('[data-hud]') as HTMLElement | null;
      if (!el) return;
      const a = el.dataset.hud;
      if (a === 'speed') this.cb.onSpeed(Number(el.dataset.v));
      if (a === 'forfeit') this.cb.onForfeit();
    });
  }

  show(engine: CombatEngine, speed: number, levels: [number, number]): void {
    this.log = [];
    const plate = (f: FighterState, side: 0 | 1) => `
      <div class="plate plate-${side}">
        <div class="plate-name"><span>${esc(f.spec.name)}</span><span class="lvl">Nv ${levels[side]}</span></div>
        <div class="bar hp"><div class="bar-fill" data-hp="${side}"></div><span class="bar-label" data-hpt="${side}"></span></div>
        <div class="bar st"><div class="bar-fill" data-st="${side}"></div></div>
      </div>`;
    this.root.innerHTML = `
      <div class="hud-top">${plate(engine.fighters[0], 0)}<div class="hud-timer" data-timer>2:00</div>${plate(engine.fighters[1], 1)}</div>
      <div class="hud-bottom">
        <div class="hud-log" data-log></div>
        <div class="hud-controls">
          <span class="speed">${[1, 2, 3].map((s) => `<button class="btn sm ${s === speed ? 'active' : ''}" data-hud="speed" data-v="${s}">${s}x</button>`).join('')}</span>
          <button class="btn sm btn-dark" data-hud="forfeit" title="Desistir (conta como derrota)">Desistir</button>
        </div>
      </div>`;
    this.root.hidden = false;
    this.push('Os gladiadores entram na arena!');
    this.update(engine);
  }

  hide(): void {
    this.root.hidden = true;
    this.root.innerHTML = '';
  }

  setSpeed(s: number): void {
    this.root.querySelectorAll<HTMLElement>('[data-hud="speed"]').forEach((b) => b.classList.toggle('active', Number(b.dataset.v) === s));
  }

  update(engine: CombatEngine): void {
    if (this.root.hidden) return;
    for (const f of engine.fighters) {
      const hp = this.root.querySelector<HTMLElement>(`[data-hp="${f.side}"]`);
      const st = this.root.querySelector<HTMLElement>(`[data-st="${f.side}"]`);
      const ht = this.root.querySelector<HTMLElement>(`[data-hpt="${f.side}"]`);
      if (hp) hp.style.width = `${(f.hp / f.spec.stats.maxHp) * 100}%`;
      if (st) st.style.width = `${(f.stamina / f.spec.stats.maxStamina) * 100}%`;
      if (ht) ht.textContent = `${Math.ceil(f.hp)} / ${f.spec.stats.maxHp}`;
    }
    const t = engine.started ? fmtDuration(Math.ceil(engine.timeRemaining)) : '—';
    if (t !== this.lastTime) {
      this.lastTime = t;
      const el = this.root.querySelector('[data-timer]');
      if (el) el.textContent = t;
    }
  }

  private push(html: string): void {
    this.log.push(html);
    if (this.log.length > 2) this.log.shift();
    const el = this.root.querySelector('[data-log]');
    if (el) el.innerHTML = this.log.map((l, i) => `<div class="${i === this.log.length - 1 ? 'new' : ''}">${l}</div>`).join('');
  }

  event(e: CombatEvent, engine: CombatEngine): void {
    const name = (s: 0 | 1) => `<b class="side-${s}">${esc(engine.fighters[s].spec.name.split(',')[0])}</b>`;
    switch (e.type) {
      case 'start':
        this.push('<b>Lutem!</b>');
        break;
      case 'skill':
        this.push(`${name(e.side)}: <span class="gold">${esc(SKILLS[e.skill].name)}</span>`);
        break;
      case 'impact':
        if (e.crit && e.outcome === 'hit') this.push(`Crítico de ${name(e.side)}!`);
        break;
      case 'exhausted':
        this.push(`${name(e.side)} está cansado!`);
        break;
      case 'end':
        this.push(`${name(e.winner)} vence!`);
        break;
    }
  }
}
