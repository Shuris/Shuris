// Menu principal: arte do jogo ao fundo, título no alto à esquerda, botões empilhados
// embaixo à esquerda (continuar, novo jogo, carregar, opções, idioma, créditos e sair)
// e a versão no canto. Os três espaços de salvamento abrem num painel.
import type { PlayerState } from '../../core/model/types';
import { parseSave } from '../../core/systems/SaveSystem';
import { reputationTitle } from '../../core/systems/ProgressionSystem';
import { SAVE_SLOTS } from '../../../shared/ipc';
import { bridge } from '../../platform/bridge';
import { esc, fmtDate } from '../dom';
import { getLang, t } from '../../i18n';
import { playerPortrait, portrait } from '../components/portraits';
import { playerHelmet } from '../components/playerLook';

export interface SlotInfo {
  slot: number;
  player: PlayerState | null;
  /** texto do save (repassado ao jogo ao continuar) */
  data: string | null;
  error?: string;
}

export interface TitleHandlers {
  onPlay(slot: number, info: SlotInfo): void;
  onDelete(slot: number): Promise<boolean>;
  onOptions(): void;
  onQuit(): void;
  onLang(): void;
}

export async function readSlots(): Promise<SlotInfo[]> {
  return Promise.all(
    SAVE_SLOTS.map(async (slot) => {
      const res = await bridge.save.read(slot);
      if (!res.data) return { slot, player: null, data: null };
      const parsed = parseSave(res.data);
      return parsed.ok ? { slot, player: parsed.player, data: res.data } : { slot, player: null, data: null, error: parsed.error };
    }),
  );
}

export class TitleScreen {
  private slots: SlotInfo[] = [];

  constructor(
    private readonly root: HTMLElement,
    private readonly h: TitleHandlers,
  ) {
    root.addEventListener('click', (e) => void this.onClick(e));
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  async show(): Promise<void> {
    this.slots = await readSlots();
    this.root.hidden = false;
    this.render();
  }

  hide(): void {
    this.root.hidden = true;
    this.root.innerHTML = '';
  }

  /** painel dos espaços de salvamento aberto (Novo jogo / Carregar) */
  private slotsOpen = false;
  private credits = false;
  private version = '';

  render(): void {
    if (this.root.hidden) return;
    if (!this.version)
      void bridge.app
        .info()
        .then((i) => {
          this.version = i.version;
          const el = this.root.querySelector('.title-version');
          if (el) el.textContent = `v${i.version}`;
        })
        .catch(() => {});
    const last = this.lastPlayed();
    const cards = this.slots.map((s) => this.slotCard(s)).join('');
    const btn = (ts: string, label: string, extra = '') => `<button class="menu-btn" data-ts="${ts}" ${extra}><span>${label}</span></button>`;
    this.root.innerHTML = `
      <div class="title-art" style="background-image:url(assets/ui/title.png)"></div>
      <div class="title-shade"></div>
      <div class="title-logo">
        <h1 class="logo">COLOSSEUM</h1>
        <p class="logo-sub">${t('title.subtitle')}</p>
      </div>
      <nav class="title-menu">
        ${last ? btn('play', t('title.continue'), `data-slot="${last.slot}"`) : ''}
        ${btn('slots-new', t('title.newGame'))}
        ${this.slots.some((s) => s.player) ? btn('slots', t('title.load')) : ''}
        ${btn('options', t('app.options'))}
        ${btn('lang', getLang() === 'pt' ? 'English' : 'Português')}
        ${btn('credits', t('title.credits'))}
        ${btn('quit', t('title.quit'))}
      </nav>
      <div class="title-version">${this.version ? `v${esc(this.version)}` : ''}</div>
      <p class="tiny title-foot">${t('title.foot')}</p>
      <div class="title-slots" ${this.slotsOpen ? '' : 'hidden'}>
        <div class="row between"><h2>${t('title.saves')}</h2><button class="btn sm" data-ts="slots-close">${t('common.back')}</button></div>
        <div class="slots">${cards}</div>
      </div>
      <div class="title-credits" ${this.credits ? '' : 'hidden'}>
        <h2>${t('title.credits')}</h2>
        <p>${t('title.creditsBody')}</p>
        <button class="btn" data-ts="credits-close">${t('common.back')}</button>
      </div>`;
    // retratos dos gladiadores salvos
    for (const s of this.slots) {
      if (!s.player) continue;
      const p = s.player;
      void playerPortrait(p.appearance, playerHelmet(p)).then((url) => {
        const img = this.root.querySelector<HTMLImageElement>(`[data-slot-pic="${s.slot}"] img`);
        if (img) img.src = url;
      });
    }
  }

  /** O gladiador jogado por último (para "Continuar"). */
  private lastPlayed(): SlotInfo | null {
    const used = this.slots.filter((s) => s.player);
    if (!used.length) return null;
    return used.reduce((a, b) => ((b.player!.updatedAt ?? 0) > (a.player!.updatedAt ?? 0) ? b : a));
  }

  private slotCard(s: SlotInfo): string {
    const label = t('title.slot', { n: s.slot });
    if (!s.player) {
      return `<div class="slot-card empty">
        <div class="slot-label">${label}</div>
        ${s.error ? `<p class="tiny red">${esc(s.error)}</p>` : `<p class="dim">${t('title.empty')}</p>`}
        <button class="btn btn-gold wide" data-ts="play" data-slot="${s.slot}">${t('title.new')}</button>
        ${s.error ? `<button class="btn btn-dark sm" data-ts="delete" data-slot="${s.slot}">${t('title.delete')}</button>` : ''}
      </div>`;
    }
    const p = s.player;
    return `<div class="slot-card">
      <div class="slot-label">${label}</div>
      <div class="slot-hero"><span data-slot-pic="${s.slot}">${portrait('player', 'md', 'data:image/gif;base64,R0lGODlhAQABAAAAACw=')}</span>
        <div><b class="slot-name">${esc(p.name)}</b>
        <div class="tiny">${t('common.level', { n: p.level })} · ${esc(reputationTitle(p.reputation))}</div>
        <div class="tiny dim">${t('title.dayInfo', { day: p.day, wins: p.stats.wins, losses: p.stats.losses })}</div>
        <div class="tiny dim">${t('title.lastPlayed', { date: fmtDate(p.updatedAt) })}</div></div></div>
      <button class="btn btn-red wide" data-ts="play" data-slot="${s.slot}">${t('title.continue')}</button>
      <button class="btn btn-dark sm" data-ts="delete" data-slot="${s.slot}">${t('title.delete')}</button>
    </div>`;
  }

  private async onClick(e: Event): Promise<void> {
    const el = (e.target as HTMLElement).closest('[data-ts]') as HTMLElement | null;
    if (!el) return;
    const a = el.dataset.ts;
    const slot = Number(el.dataset.slot);
    if (a === 'play') {
      const info = this.slots.find((s) => s.slot === slot);
      if (info) this.h.onPlay(slot, info);
    } else if (a === 'delete') {
      if (await this.h.onDelete(slot)) await this.show();
    } else if (a === 'slots' || a === 'slots-new') {
      this.slotsOpen = true;
      this.credits = false;
      this.render();
    } else if (a === 'slots-close') {
      this.slotsOpen = false;
      this.render();
    } else if (a === 'credits' || a === 'credits-close') {
      this.credits = a === 'credits';
      this.slotsOpen = false;
      this.render();
    } else if (a === 'options') this.h.onOptions();
    else if (a === 'quit') this.h.onQuit();
    else if (a === 'lang') this.h.onLang();
  }
}
