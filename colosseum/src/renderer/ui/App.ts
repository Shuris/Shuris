// Controlador principal da interface: liga a UI (DOM), o estado (GameStore),
// a camada visual (Phaser), o som e a janela desktop (bridge/IPC).
import type { WindowState } from '../../shared/ipc';
import { GameStore } from '../core/GameStore';
import type { Appearance, PlayerState, TrainingId } from '../core/model/types';
import { CombatEngine } from '../core/combat/CombatEngine';
import type { CombatResult } from '../core/combat/CombatTypes';
import { opponentCombatant, playerCombatant, type FighterVisual } from '../core/combat/CombatantFactory';
import { getOpponent, type OpponentDef } from '../core/data/opponents';
import { arenaForOpponent } from '../core/data/arenas';
import { getItem } from '../core/data/equipment';
import { applyBattleResult, isUnlocked, xpToNext } from '../core/systems/ProgressionSystem';
import { createPlayer } from '../core/systems/PlayerFactory';
import { train as doTrain, trainingCost } from '../core/systems/TrainingSystem';
import { clockLabel, phaseName, timeOfDay } from '../core/systems/TimeOfDay';
import { createRng, randomSeed } from '../core/systems/rng';
import { MAX_LEVEL } from '../core/data/gladiators';
import { bridge, isElectron } from '../platform/bridge';
import { sound } from '../audio/SoundManager';
import { GameView } from '../game/Game';
import { $, bar, esc, icon } from './dom';
import { closeModal, confirmModal, hasModal, openModal, toast } from './components/feedback';
import { BattleHud } from './screens/BattleHud';
import { resultHtml } from './screens/BattleResultScreen';
import { CharacterScreen } from './screens/CharacterScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { IntroScreen } from './screens/IntroScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { MainMenu } from './screens/MainMenu';
import { TrainingScreen } from './screens/TrainingScreen';
import type { AppActions, Screen, TabId } from './screens/Screen';

interface BattleCtx {
  opponent: OpponentDef;
  strategy: PlayerState['strategy'];
  engine: CombatEngine | null;
}

export class App implements AppActions {
  readonly store = new GameStore({
    read: () => bridge.save.read(),
    write: (d) => bridge.save.write(d),
    writeSync: (d) => bridge.save.writeSync(d),
  });
  readonly sound = sound;
  private view!: GameView;
  private screens: Record<TabId, Screen>;
  private tab: TabId = 'arena';
  private win: WindowState = { maximized: false, fullscreen: false };
  private battle: BattleCtx | null = null;
  private hud!: BattleHud;
  private intro: IntroScreen | null = null;
  private trainingBusy = false;
  private autoTimer: ReturnType<typeof setInterval> | null = null;
  private autoPending = false;
  private chanceCache = new Map<string, number>();

  constructor(private readonly root: HTMLElement) {
    const deps = { store: this.store, actions: this as AppActions };
    this.screens = {
      arena: new MainMenu(deps),
      gladiator: new CharacterScreen(deps),
      training: new TrainingScreen(deps),
      equipment: new InventoryScreen(deps),
      history: new HistoryScreen(),
    };
  }

  // ---------------------------------------------------------------- inicialização
  async init(): Promise<void> {
    this.root.innerHTML = this.shellHtml();
    this.hud = new BattleHud($('#hud'), {
      onSpeed: (s) => this.setSpeed(s),
      onForfeit: () => void this.forfeit(),
    });
    this.bindShell();
    this.view = new GameView($('#game'));
    this.store.onSaveError = (msg) => toast(`Falha ao salvar: ${msg}`, 'bad', 6000);
    this.store.subscribe(() => this.onStateChange());

    const [, winState, loaded] = await Promise.all([this.view.ready, bridge.win.getState(), this.store.load()]);
    this.applyWindowState(winState);
    bridge.win.onState((s) => this.applyWindowState(s));
    $('#loading').remove();

    if (loaded.player) {
      this.applySettings();
      this.enterHub();
      toast(loaded.notice ?? `Bem-vindo de volta, ${loaded.player.name}!`, loaded.notice ? 'info' : 'gold', 5000);
    } else {
      if (loaded.notice) toast(loaded.notice, 'bad', 8000);
      this.startIntro();
    }
    window.addEventListener('beforeunload', () => this.store.flushSync());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (hasModal()) closeModal();
        else if (this.win.fullscreen) void this.setFullscreen(false);
      }
      if (e.key === 'F11' && !isElectron) {
        e.preventDefault();
        void this.setFullscreen(!this.win.fullscreen);
      }
    });
    // som de clique em todos os botões
    document.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (b && !b.disabled) sound.play('click');
    });
    new ResizeObserver(() => this.updateLayout()).observe($('#stage'));
    setInterval(() => this.renderClock(), 1000);
    (window as unknown as { __colosseum: App }).__colosseum = this; // usado pelos testes E2E
  }

  private shellHtml(): string {
    const tabs: Array<[TabId, string]> = [
      ['arena', 'Arena'],
      ['gladiator', 'Gladiador'],
      ['training', 'Treino'],
      ['equipment', 'Itens'],
      ['history', 'Histórico'],
    ];
    return `
      <header id="titlebar">
        <img src="assets/ui/app-icon.png" alt="" class="tb-icon"><span class="tb-title">COLOSSEUM</span>
        <span class="tb-space"></span>
        <button class="tb-btn tb-text" data-w="sound" title="Ligar/desligar som">Som</button>
        <button class="tb-btn tb-text" data-w="fullscreen" title="Tela cheia (F11)">Tela cheia</button>
        <button class="tb-btn tb-text" data-w="options" title="Opções">Opções</button>
        <button class="tb-btn" data-w="min" title="Minimizar">&#8211;</button>
        <button class="tb-btn" data-w="max" title="Maximizar">&#9633;</button>
        <button class="tb-btn tb-close" data-w="close" title="Fechar">&#215;</button>
      </header>
      <div id="stage">
        <div id="game"></div>
        <div id="statusbar" hidden></div>
        <aside id="side" hidden>
          <nav id="tabs">${tabs.map(([id, n]) => `<button class="tab" data-tab="${id}">${n}</button>`).join('')}</nav>
          <section id="panel" class="panel"></section>
        </aside>
        <div id="hud" hidden></div>
        <button id="exit-fullscreen" class="btn btn-dark" hidden title="Sair da tela cheia (Esc)">Sair da tela cheia</button>
        <div id="intro" hidden></div>
        <div id="modal-root"></div>
        <div id="toast-root"></div>
        <div id="loading"><div class="loading-box">Preparando a arena…</div></div>
      </div>`;
  }

  private bindShell(): void {
    $('#titlebar').addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('[data-w]')?.getAttribute('data-w');
      if (a === 'min') bridge.win.minimize();
      else if (a === 'max') bridge.win.toggleMaximize();
      else if (a === 'close') {
        this.store.flushSync();
        bridge.win.close();
      } else if (a === 'fullscreen') void this.setFullscreen(true);
      else if (a === 'sound') this.toggleMute();
      else if (a === 'options') this.openOptions();
    });
    $('#titlebar').addEventListener('dblclick', (e) => {
      if (!(e.target as HTMLElement).closest('button')) bridge.win.toggleMaximize();
    });
    $('#exit-fullscreen').addEventListener('click', () => void this.setFullscreen(false));
    $('#tabs').addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-tab]')?.getAttribute('data-tab') as TabId | null;
      if (t) this.goTab(t);
    });
    const panel = $('#panel');
    const handle = (e: Event) => {
      const el = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
      if (!el || !this.store.hasPlayer) return;
      if (e.type === 'click' && el.tagName === 'INPUT') return;
      if (e.type === 'change' && el.tagName !== 'INPUT') return;
      if (el.dataset.action === 'tip-ok') {
        const id = el.dataset.id ?? '';
        this.store.update((p) => p.settings.tipsSeen.push(id));
        return;
      }
      this.screens[this.tab].onAction(el.dataset.action ?? '', el, this.store.state);
    };
    panel.addEventListener('click', handle);
    panel.addEventListener('change', handle);
  }

  // ---------------------------------------------------------------- janela, som e opções
  async setFullscreen(on: boolean): Promise<void> {
    const s = await bridge.win.setFullscreen(on);
    this.applyWindowState(s);
  }

  private applyWindowState(s: WindowState): void {
    const wasFull = this.win.fullscreen;
    this.win = s;
    this.root.classList.toggle('fullscreen', s.fullscreen);
    this.root.classList.toggle('maximized', s.maximized);
    $('#exit-fullscreen').hidden = !s.fullscreen;
    if (s.fullscreen && !wasFull) toast('Tela cheia · Esc ou F11 para sair', 'info', 3000);
    requestAnimationFrame(() => this.updateLayout());
  }

  private applySettings(): void {
    if (!this.store.hasPlayer) return;
    const st = this.store.state.settings;
    sound.setVolume(st.volume);
    sound.setMuted(st.muted);
    this.view.dayNight = st.dayNight;
    const btn = this.root.querySelector('[data-w="sound"]');
    if (btn) {
      btn.textContent = st.muted ? 'Som: não' : 'Som: sim';
      btn.classList.toggle('off', st.muted);
    }
  }

  private toggleMute(): void {
    if (!this.store.hasPlayer) {
      sound.setMuted(false);
      return;
    }
    this.store.update((p) => (p.settings.muted = !p.settings.muted));
    toast(this.store.state.settings.muted ? 'Som desligado' : 'Som ligado', 'info', 1500);
  }

  private updateLayout(): void {
    if (!this.view) return;
    const stage = $('#stage').getBoundingClientRect();
    let right = 0;
    const side = $('#side');
    const create = this.root.querySelector('.intro-create .create, .intro-story .story') as HTMLElement | null;
    if (!this.battle && !side.hidden) right = stage.right - side.getBoundingClientRect().left + 8;
    else if (create) right = stage.right - create.getBoundingClientRect().left + 8;
    const top = this.battle ? 80 : 0;
    const bottom = this.battle ? 60 : 0;
    this.view.setLayout({ right, top, bottom });
  }

  private openOptions(): void {
    void bridge.app.info().then((info) => {
      const st = this.store.hasPlayer ? this.store.state.settings : null;
      const m = openModal(`
        <h2>Opções</h2>
        ${
          st
            ? `<div class="opt-row"><span>Volume</span><input type="range" min="0" max="100" step="5" value="${Math.round(st.volume * 100)}" data-o="volume"></div>
        <div class="opt-row"><span>Som</span><button class="btn sm ${st.muted ? '' : 'active'}" data-o="unmute">Ligado</button><button class="btn sm ${st.muted ? 'active' : ''}" data-o="mute">Desligado</button></div>
        <div class="opt-row"><span>Dia e noite</span><button class="btn sm ${st.dayNight === 'cycle' ? 'active' : ''}" data-o="cycle">Rápido (10 min)</button><button class="btn sm ${st.dayNight === 'real' ? 'active' : ''}" data-o="real">Hora do PC</button></div>`
            : ''
        }
        <div class="opt-row"><span>Tela</span><button class="btn sm" data-o="fullscreen">${this.win.fullscreen ? 'Sair da tela cheia' : 'Tela cheia (F11)'}</button></div>
        <p class="tiny dim">Salvo em: ${esc(info.savePath)} · v${esc(info.version)}</p>
        <div class="row between"><button class="btn btn-dark sm" data-o="reset">Apagar progresso</button><button class="btn" data-o="close">Fechar</button></div>`);
      m.addEventListener('input', (e) => {
        const el = e.target as HTMLInputElement;
        if (el.dataset.o === 'volume' && this.store.hasPlayer) {
          const v = Number(el.value) / 100;
          this.store.update((p) => {
            p.settings.volume = v;
            p.settings.muted = false;
          });
        }
      });
      m.addEventListener('change', (e) => {
        if ((e.target as HTMLElement).dataset.o === 'volume') sound.play('coin');
      });
      m.addEventListener('click', async (e) => {
        const a = (e.target as HTMLElement).closest('[data-o]')?.getAttribute('data-o');
        if (!a || a === 'volume') return;
        if (a === 'close') return closeModal();
        if (a === 'fullscreen') {
          closeModal();
          return void this.setFullscreen(!this.win.fullscreen);
        }
        if (a === 'mute' || a === 'unmute') this.store.update((p) => (p.settings.muted = a === 'mute'));
        if (a === 'cycle' || a === 'real') this.store.update((p) => (p.settings.dayNight = a));
        if (a === 'reset') {
          const ok = await confirmModal('Apagar tudo?', 'O gladiador e todo o progresso serão apagados.', 'Apagar');
          if (!ok) return;
          await bridge.save.remove();
          this.store.reset();
          this.chanceCache.clear();
          if (this.battle) this.exitBattle();
          $('#side').hidden = true;
          $('#statusbar').hidden = true;
          this.startIntro();
          return;
        }
        if (a !== 'reset') {
          closeModal();
          this.openOptions();
        }
      });
    });
  }

  // ---------------------------------------------------------------- intro
  private startIntro(): void {
    const preview = (a: Appearance): FighterVisual => ({ appearance: a, gear: { mainHand: getItem('rudis') } });
    this.intro = new IntroScreen(
      $('#intro'),
      (a) => {
        this.view.updateVisual(preview(a));
        requestAnimationFrame(() => this.updateLayout());
      },
      (r) => {
        const p = createPlayer(r.name, r.origin, r.appearance);
        this.store.setPlayer(p);
        void this.store.flush();
        this.intro?.close();
        this.intro = null;
        this.applySettings();
        this.enterHub();
        sound.play('levelup');
        toast(`${p.name} chegou ao ludus!`, 'gold');
      },
    );
    this.view.showHub(preview({ skin: 0, hairStyle: 0, hairColor: 0, beard: false, clothColor: 0 }));
    this.intro.start();
  }

  private enterHub(): void {
    this.view.showHub(playerCombatant(this.store.state).visual);
    $('#side').hidden = false;
    $('#statusbar').hidden = false;
    this.root.classList.remove('in-battle');
    this.goTab(this.tab);
    this.renderStatus();
    requestAnimationFrame(() => this.updateLayout());
  }

  // ---------------------------------------------------------------- AppActions
  get training(): boolean {
    return this.trainingBusy;
  }

  goTab(id: TabId): void {
    this.tab = id;
    this.root.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.getAttribute('data-tab') === id));
    this.renderPanel(true);
  }

  rerender(): void {
    this.renderPanel();
  }

  refreshVisual(): void {
    if (this.store.hasPlayer && !this.battle) this.view.updateVisual(playerCombatant(this.store.state).visual);
  }

  winChance(opponentId: string): number {
    const p = this.store.state;
    const def = getOpponent(opponentId);
    if (!def) return 0;
    const me = playerCombatant(p).spec;
    const key = `${opponentId}|${JSON.stringify(me)}`;
    const cached = this.chanceCache.get(key);
    if (cached !== undefined) return cached;
    const them = opponentCombatant(def).spec;
    const N = 40;
    let wins = 0;
    for (let i = 0; i < N; i++) if (new CombatEngine(me, them, { seed: 7919 * (i + 1) }).runToEnd().winner === 0) wins++;
    const c = wins / N;
    this.chanceCache.set(key, c);
    return c;
  }

  train(id: TrainingId): void {
    if (this.trainingBusy || this.battle) return;
    const apply = () => {
      this.trainingBusy = false;
      const r = this.store.update((p) => doTrain(p, id));
      if (!r.ok) {
        toast(r.message, 'bad');
        sound.play('error');
        this.renderPanel();
        return;
      }
      toast(r.attributeGained ? '+1 atributo!' : `Treino feito: +${r.xp} XP`, r.attributeGained ? 'gold' : 'good');
      this.view.showGain(r.attributeGained ? '+1 atributo!' : `+${r.xp} XP`);
      if (r.attributeGained) sound.play('levelup');
      if (r.levelUps) {
        sound.play('levelup');
        toast(`Nível ${this.store.state.level}! +${r.levelUps * 3} pontos`, 'gold', 5000);
      }
    };
    if (this.store.state.coins < trainingCost(this.store.state, id)) {
      sound.play('error');
      return toast('Moedas insuficientes.', 'bad');
    }
    this.trainingBusy = true;
    this.renderPanel();
    if (!this.view.playTraining(id, apply)) apply();
  }

  // ---------------------------------------------------------------- batalha
  startBattle(opponentId?: string): void {
    if (this.battle || this.trainingBusy || !this.store.hasPlayer) return;
    const p = this.store.state;
    const def = getOpponent(opponentId ?? p.selectedOpponent);
    if (!def || !isUnlocked(p, def.id)) {
      toast('Adversário indisponível.', 'bad');
      return;
    }
    this.cancelAuto();
    closeModal();
    const me = playerCombatant(p);
    const them = opponentCombatant(def);
    this.battle = { opponent: def, strategy: p.strategy, engine: null };
    this.root.classList.add('in-battle');
    $('#side').hidden = true;
    $('#statusbar').hidden = true;
    this.updateLayout();
    this.view.startBattle(
      { fighters: [me, them], arena: arenaForOpponent(def.id), seed: randomSeed(), speed: p.settings.battleSpeed },
      {
        onReady: (engine) => {
          if (!this.battle) return;
          this.battle.engine = engine;
          this.hud.show(engine, this.store.state.settings.battleSpeed, [p.level, def.level]);
        },
        onEvent: (e, engine) => this.hud.event(e, engine),
        onFrame: (engine) => this.hud.update(engine),
        onEnd: (res) => this.finishBattle(res),
      },
    );
  }

  private setSpeed(s: number): void {
    if (![1, 2, 3].includes(s)) return;
    this.store.update((p) => (p.settings.battleSpeed = s));
    this.view.setSpeed(s);
    this.hud.setSpeed(s);
  }

  private async forfeit(): Promise<void> {
    if (!this.battle?.engine || this.battle.engine.finished) return;
    const ok = await confirmModal('Desistir?', 'Conta como derrota, mas você não perde nada.', 'Desistir');
    if (ok) this.view.forfeit();
  }

  private finishBattle(res: CombatResult): void {
    const ctx = this.battle;
    if (!ctx) return;
    const won = res.winner === 0;
    const rng = createRng(randomSeed());
    const rw = this.store.update((p) =>
      applyBattleResult(p, { opponent: ctx.opponent, won, reason: res.reason, duration: res.duration, strategy: ctx.strategy, rng }),
    );
    this.chanceCache.clear();
    void this.store.flush();
    if (rw.levelUps) setTimeout(() => sound.play('levelup'), 600);
    if (rw.coins) sound.play('coin');
    const auto = this.store.state.settings.autoContinue;
    const m = openModal(resultHtml(res, rw, ctx.opponent, auto), {
      cls: 'modal-result',
      onClose: () => {
        if (this.battle && !this.autoPending) this.exitBattle();
      },
    });
    m.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('[data-r]')?.getAttribute('data-r');
      if (!a) return;
      if (a === 'again') this.rematch(ctx.opponent.id);
      else if (a === 'points') {
        closeModal();
        this.goTab('gladiator');
      } else closeModal();
    });
    if (auto) this.scheduleAuto(m, ctx.opponent.id);
  }

  private rematch(opponentId: string): void {
    this.cancelAuto();
    this.autoPending = true;
    closeModal();
    this.autoPending = false;
    this.battle = null;
    this.hud.hide();
    this.startBattle(opponentId);
  }

  private scheduleAuto(modal: HTMLElement, opponentId: string): void {
    let left = 8;
    const label = modal.querySelector('[data-countdown]');
    const tick = () => {
      if (label) label.textContent = `Próxima luta em ${left}s`;
      if (left-- <= 0) {
        if (this.store.state.settings.autoContinue) this.rematch(opponentId);
        else this.cancelAuto();
      }
    };
    tick();
    this.autoTimer = setInterval(tick, 1000);
  }

  private cancelAuto(): void {
    if (this.autoTimer) clearInterval(this.autoTimer);
    this.autoTimer = null;
  }

  private exitBattle(): void {
    this.cancelAuto();
    this.battle = null;
    this.hud.hide();
    if (this.store.hasPlayer) this.enterHub();
  }

  // ---------------------------------------------------------------- renderização
  private onStateChange(): void {
    this.applySettings();
    this.renderStatus();
    if (!this.battle) this.renderPanel();
  }

  private renderStatus(): void {
    if (!this.store.hasPlayer) return;
    const p = this.store.state;
    $('#statusbar').innerHTML = `
      <div class="status panel">
        <div class="row between"><b class="st-name">${esc(p.name)}</b><span class="lvl">Nível ${p.level}</span></div>
        ${p.level < MAX_LEVEL ? bar(p.xp, xpToNext(p.level), 'xp') : '<div class="tiny gold">Nível máximo</div>'}
        <div class="row st-res"><span title="Moedas">${icon('coin')} ${p.coins}</span><span title="Fama">${icon('laurel')} ${p.reputation}</span>
        <span class="clock" id="clock"></span></div>
        ${p.unspentPoints ? `<button class="btn btn-gold wide pts" data-goto="gladiator">+${p.unspentPoints} pontos</button>` : ''}
      </div>`;
    $('#statusbar')
      .querySelector('[data-goto]')
      ?.addEventListener('click', () => this.goTab('gladiator'));
    this.renderClock();
  }

  private renderClock(): void {
    const el = this.root.querySelector('#clock');
    if (!el || !this.store.hasPlayer) return;
    const t = timeOfDay(this.store.state.settings.dayNight);
    el.textContent = `${phaseName(t)} ${clockLabel(t)}`;
  }

  private renderPanel(resetScroll = false): void {
    if (!this.store.hasPlayer) return;
    const panel = $('#panel');
    const scroll = resetScroll ? 0 : panel.scrollTop;
    const p = this.store.state;
    const screen = this.screens[this.tab];
    const tip = p.settings.tipsSeen.includes(screen.id)
      ? ''
      : `<div class="tip">${esc(screen.tip)} <button class="btn sm" data-action="tip-ok" data-id="${screen.id}">OK</button></div>`;
    panel.innerHTML = `${tip}${screen.render(p)}`;
    panel.scrollTop = scroll;
  }
}
