// Controlador principal da interface: liga a UI (DOM), o estado (GameStore),
// a camada visual (Phaser), o som e a janela desktop (bridge/IPC).
import type { WindowState } from '../../shared/ipc';
import { GameStore } from '../core/GameStore';
import type { Appearance, FightMode, LocationId, PlayerState, TrainingId } from '../core/model/types';
import { CombatEngine } from '../core/combat/CombatEngine';
import type { CombatResult } from '../core/combat/CombatTypes';
import { opponentCombatant, playerCombatant, type FighterVisual } from '../core/combat/CombatantFactory';
import { getOpponent, type OpponentDef } from '../core/data/opponents';
import { arenaForOpponent, type ArenaDef } from '../core/data/arenas';
import { getLocation, hoursLabel, isOpen, weekdayName } from '../core/data/locations';
import { getItem } from '../core/data/equipment';
import { applyBattleResult, xpToNext } from '../core/systems/ProgressionSystem';
import { createPlayer } from '../core/systems/PlayerFactory';
import { train as doTrain } from '../core/systems/TrainingSystem';
import { applyFight, applyTraining, bathe, canFight, canTrain, canTravel, nap, sleep, travel } from '../core/systems/CalendarSystem';
import { nextRival, onEvent, publish, unreadCount } from '../core/systems/NewsSystem';
import { recordFightOnly } from '../core/systems/ProgressionSystem';
import { abandonTournament, checkNoShow, closeTournament, playerMatch, recordPlayerFight, register, startTournament, timeForFight, TOURNAMENT_ENERGY } from '../core/systems/TournamentSystem';
import { expireRematch, fightDef, introMoment, ladderCheck, rematchActive, seeMedic } from '../core/systems/RivalSystem';
import { armSetup, canArmWrestle, finishArmWrestle, isArmNight, isFestival, isMerchantDay } from '../core/systems/EventSystem';
import type { TalkMoment } from '../core/data/dialogue';
import { bracketHtml } from './screens/TournamentView';
import { playArmWrestle } from './components/ArmWrestle';
import { playerPortrait } from './components/portraits';
import { playerHelmet, playerPortraitKey } from './components/playerLook';
import { todaysChallenger } from './screens/MainMenu';
import { music } from '../audio/Music';
import { fxEnabled, setFxEnabled } from '../game/shaders';
import { itemName } from '../i18n/data';
import { clockLabel, dayFraction, phaseName } from '../core/systems/TimeOfDay';
import { weatherAt, weatherLabel, weatherOfDay } from '../core/systems/WeatherSystem';
import { worldWeather } from '../game/DayNight';
import { setSpeechObstacles } from '../game/speech';
import { createRng, randomSeed } from '../core/systems/rng';
import { MAX_LEVEL } from '../core/data/gladiators';
import { bridge } from '../platform/bridge';
import { sound } from '../audio/SoundManager';
import { GameView } from '../game/Game';
import { $, bar, esc, icon } from './dom';
import { closeModal, confirmModal, hasModal, openModal, toast } from './components/feedback';
import { BattleHud } from './screens/BattleHud';
import { resultHtml } from './screens/BattleResultScreen';
import { BathsScreen } from './screens/BathsScreen';
import { CharacterScreen } from './screens/CharacterScreen';
import { ForumScreen, newspaperHtml } from './screens/ForumScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { IntroScreen } from './screens/IntroScreen';
import { MainMenu } from './screens/MainMenu';
import { TitleScreen, type SlotInfo } from './screens/TitleScreen';
import { MapScreen } from './screens/MapScreen';
import { MarketScreen } from './screens/MarketScreen';
import { TempleScreen } from './screens/TempleScreen';
import { TrainingScreen } from './screens/TrainingScreen';
import type { AppActions, Screen, ScreenId } from './screens/Screen';
import { TavernScreen } from './screens/TavernScreen';
import { eat, hearRumor } from '../core/systems/TavernSystem';
import { npcLine } from '../core/data/dialogue';
import { tk, variant } from '../i18n';
import { getLang, setLang, t, type Lang } from '../i18n';
import { locationName } from '../i18n/data';
import { loadLang, saveLang } from '../i18n/prefs';

interface BattleCtx {
  opponent: OpponentDef;
  mode: FightMode;
  strategy: PlayerState['strategy'];
  engine: CombatEngine | null;
}

const LOCATION_IDS: LocationId[] = ['ludus', 'home', 'market', 'arena', 'temple', 'forum', 'baths', 'tavern'];

export class App implements AppActions {
  /** espaço de salvamento em uso (1 a 3) */
  private slot = 1;
  readonly store = new GameStore({
    read: () => bridge.save.read(this.slot),
    write: (d) => bridge.save.write(this.slot, d),
    writeSync: (d) => bridge.save.writeSync(this.slot, d),
  });
  private title!: TitleScreen;
  private paused = false;
  readonly sound = sound;
  readonly music = music;
  /** previsão do tempo de um dia (usada pelos testes E2E) */
  readonly weatherOfDay = (day: number) => weatherOfDay(this.store.state.createdAt, day);
  /** dia de visita do mercador (testes E2E) */
  readonly isMerchantDay = (day: number) => isMerchantDay(this.store.state.createdAt, day);
  private view!: GameView;
  private screens: Record<ScreenId, Screen>;
  private screen: ScreenId = 'home';
  private win: WindowState = { maximized: false, fullscreen: false };
  private battle: BattleCtx | null = null;
  private hud!: BattleHud;
  private intro: IntroScreen | null = null;
  private busy = false;
  private chanceCache = new Map<string, number>();

  constructor(private readonly root: HTMLElement) {
    const deps = { store: this.store, actions: this as AppActions };
    this.screens = {
      arena: new MainMenu(deps),
      ludus: new TrainingScreen(deps),
      market: new MarketScreen(deps),
      home: new HomeScreen(deps),
      temple: new TempleScreen(deps),
      forum: new ForumScreen(deps),
      baths: new BathsScreen(deps),
      tavern: new TavernScreen(deps),
      map: new MapScreen(deps),
      gladiator: new CharacterScreen(deps),
      history: new HistoryScreen(),
    };
  }

  // ---------------------------------------------------------------- inicialização
  async init(): Promise<void> {
    setLang(loadLang());
    this.root.innerHTML = this.shellHtml();
    this.hud = new BattleHud($('#hud'), {
      onSpeed: (s) => this.setSpeed(s),
      onForfeit: () => void this.forfeit(),
    });
    this.bindShell();
    this.view = new GameView($('#game'));
    this.view.time = () => (this.store.hasPlayer ? dayFraction(this.store.state.minutes) : 0.4);
    this.view.minutes = () => (this.store.hasPlayer ? this.store.state.minutes : 480);
    this.view.day = () => (this.store.hasPlayer ? this.store.state.day : 1);
    worldWeather.now = () => {
      if (!this.store.hasPlayer) return { cloud: 0, rain: 0 };
      const p = this.store.state;
      return weatherAt(p.createdAt, p.day, p.minutes);
    };
    // balões de fala desviam das janelas da interface
    const SPEECH_OBSTACLES = '#statusbar:not([hidden]) .status, #side:not([hidden]), #hud:not([hidden]) .plate, #hud:not([hidden]) .hud-timer, #hud:not([hidden]) .hud-log, #hud:not([hidden]) .hud-controls, #toast-root .toast';
    setSpeechObstacles(() => Array.from(this.root.querySelectorAll<HTMLElement>(SPEECH_OBSTACLES), (el) => el.getBoundingClientRect()));
    this.store.onSaveError = (msg) => toast(t('app.saveFailed', { msg }), 'bad', 6000);
    this.store.subscribe(() => this.onStateChange());

    const [, winState] = await Promise.all([this.view.ready, bridge.win.getState()]);
    this.applyWindowState(winState);
    bridge.win.onState((s) => this.applyWindowState(s));
    $('#loading').remove();
    this.title = new TitleScreen($('#title'), {
      onPlay: (slot, info) => void this.playSlot(slot, info),
      onDelete: (slot) => this.deleteSlot(slot),
      onOptions: () => this.openOptions(),
      onQuit: () => this.quit(),
      onLang: () => this.changeLang(getLang() === 'pt' ? 'en' : 'pt'),
    });
    await this.showTitle();
    window.addEventListener('beforeunload', () => this.store.flushSync());
    // rede de segurança: um erro inesperado não pode congelar a animação do jogo
    window.addEventListener('error', (e) => {
      console.error('[colosseum] erro', e.message);
      this.recoverLoop();
    });
    window.addEventListener('unhandledrejection', (e) => console.error('[colosseum] promessa rejeitada', e.reason));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Esc: fecha a janela aberta ou pausa o jogo (menu de pausa)
        if (hasModal()) closeModal();
        else if (this.store.hasPlayer && !this.title.visible && !this.intro) this.openPause();
      }
      // no Electron o processo principal já trata o F11 (antes de chegar aqui);
      // este caminho cobre o navegador e eventos sintéticos
      if (e.key === 'F11') {
        e.preventDefault();
        void this.setFullscreen(!this.win.fullscreen);
      }
    });
    document.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (b && !b.disabled) sound.play('click');
    });
    new ResizeObserver(() => this.updateLayout()).observe($('#stage'));
    (window as unknown as { __colosseum: App }).__colosseum = this; // usado pelos testes E2E
  }

  private shellHtml(): string {
    return `
      <div id="stage">
        <div id="game"></div>
        <div id="statusbar" hidden></div>
        <aside id="side" hidden>
          <nav id="nav">
            <button class="tab" data-nav="map" data-t="nav.map">${t('nav.map')}</button>
            <button class="tab" data-nav="gladiator" data-t="nav.gladiator">${t('nav.gladiator')}</button>
            <button class="tab" data-nav="history" data-t="nav.history">${t('nav.history')}</button>
          </nav>
          <section id="panel" class="panel"></section>
        </aside>
        <div id="hud" hidden></div>
        <div id="intro" hidden></div>
        <div id="title" hidden></div>
        <div id="modal-root"></div>
        <div id="toast-root"></div>
        <div id="loading"><div class="loading-box">${t('app.loading')}</div></div>
      </div>`;
  }

  private bindShell(): void {
    this.applyShellText();
    $('#nav').addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-nav]')?.getAttribute('data-nav') as ScreenId | null;
      if (!t) return;
      // clicar de novo na ficha aberta volta para o local atual
      if (t === this.screen && t !== 'map') this.open(this.store.state.location);
      else this.open(t);
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
      if (el.dataset.action === 'back') return this.open(this.store.state.location);
      this.screens[this.screen].onAction(el.dataset.action ?? '', el, this.store.state);
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
    if (!s.fullscreen && wasFull) toast(t('app.windowedToast'), 'info', 3000);
    requestAnimationFrame(() => this.updateLayout());
  }

  private applySettings(): void {
    if (!this.store.hasPlayer) return;
    const st = this.store.state.settings;
    sound.setVolume(st.volume);
    sound.setMuted(st.muted);
  }

  private updateLayout(): void {
    if (!this.view) return;
    const stage = $('#stage').getBoundingClientRect();
    let right = 0;
    const side = $('#side');
    const create = this.root.querySelector('.intro-create .create, .intro-story .story') as HTMLElement | null;
    if (!this.battle && !side.hidden) right = stage.right - side.getBoundingClientRect().left + 8;
    else if (create) right = stage.right - create.getBoundingClientRect().left + 8;
    this.view.setLayout({ right, top: this.battle ? 80 : 0, bottom: this.battle ? 60 : 0 });
  }

  /** Troca o idioma: salva a preferência e redesenha tudo o que tem texto. */
  changeLang(l: Lang): void {
    setLang(l);
    saveLang(l);
    if (this.store.hasPlayer) this.store.update((p) => (p.settings.language = l));
    this.applyShellText();
    this.applySettings();
    this.intro?.rerender();
    if (this.store.hasPlayer && !this.battle) {
      this.renderStatus();
      this.renderPanel();
      if (this.view.scene === 'map') this.view.refreshMap();
      else if (this.view.scene === 'hub') this.enterLocation();
    }
    this.chanceCache.clear();
  }

  /** Textos fixos da moldura (barra de título, abas) no idioma atual. */
  private applyShellText(): void {
    this.root.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => (el.textContent = t(el.dataset.t as Parameters<typeof t>[0])));
    this.root.querySelectorAll<HTMLElement>('[data-tt]').forEach((el) => (el.title = t(el.dataset.tt as Parameters<typeof t>[0])));
    this.title?.render();
  }

  private openOptions(back?: () => void): void {
    void bridge.app.info().then((info) => {
      const st = this.store.hasPlayer ? this.store.state.settings : null;
      const sfxVol = st ? st.volume : sound.currentVolume;
      const sfxMuted = st ? st.muted : sound.isMuted;
      const m = openModal(`
        <h2>${t('app.options')}</h2>
        <div class="opt-row"><span>${t('opt.language')}</span><button class="btn sm ${getLang() === 'pt' ? 'active' : ''}" data-o="lang-pt">Português</button><button class="btn sm ${getLang() === 'en' ? 'active' : ''}" data-o="lang-en">English</button></div>
        <div class="opt-row"><span>${t('opt.music')}</span><button class="btn sm ${music.enabled ? 'active' : ''}" data-o="music-on">${t('opt.on')}</button><button class="btn sm ${music.enabled ? '' : 'active'}" data-o="music-off">${t('opt.off')}</button></div>
        <div class="opt-row"><span>${t('opt.musicVolume')}</span><input type="range" min="0" max="100" step="5" value="${Math.round(music.volume * 100)}" data-o="music-volume"></div>
        <div class="opt-row"><span>${t('opt.sound')}</span><button class="btn sm ${sfxMuted ? '' : 'active'}" data-o="unmute">${t('opt.on')}</button><button class="btn sm ${sfxMuted ? 'active' : ''}" data-o="mute">${t('opt.off')}</button></div>
        <div class="opt-row"><span>${t('opt.volume')}</span><input type="range" min="0" max="100" step="5" value="${Math.round(sfxVol * 100)}" data-o="volume"></div>
        <div class="opt-row"><span>${t('opt.fx')}</span><button class="btn sm ${fxEnabled() ? 'active' : ''}" data-o="fx-on">${t('opt.on')}</button><button class="btn sm ${fxEnabled() ? '' : 'active'}" data-o="fx-off">${t('opt.off')}</button></div>
        <div class="opt-row"><span>${t('opt.screen')}</span><button class="btn sm" data-o="fullscreen">${this.win.fullscreen ? t('opt.windowed') : t('opt.fullscreenF11')}</button></div>
        <p class="tiny dim">${t('opt.savedAt', { path: esc(info.savePath), version: esc(info.version) })}</p>
        <div class="row end"><button class="btn" data-o="close">${back ? t('common.back') : t('common.close')}</button></div>`,
        { onClose: () => !reopening && back?.() });
      let reopening = false;
      const reopen = () => {
        reopening = true;
        closeModal();
        this.openOptions(back);
      };
      m.addEventListener('input', (e) => {
        const el = e.target as HTMLInputElement;
        const v = Number(el.value) / 100;
        if (el.dataset.o === 'music-volume') music.setVolume(v);
        if (el.dataset.o === 'volume') this.setSfx(v, false);
      });
      m.addEventListener('change', (e) => {
        if ((e.target as HTMLElement).dataset.o === 'volume') sound.play('coin');
      });
      m.addEventListener('click', (e) => {
        const a = (e.target as HTMLElement).closest('[data-o]')?.getAttribute('data-o');
        if (!a || a === 'volume' || a === 'music-volume') return;
        if (a === 'close') return closeModal();
        if (a === 'lang-pt' || a === 'lang-en') {
          this.changeLang(a === 'lang-pt' ? 'pt' : 'en');
          return reopen();
        }
        if (a === 'fullscreen') {
          void this.setFullscreen(!this.win.fullscreen);
          return reopen();
        }
        if (a === 'music-on' || a === 'music-off') {
          music.setEnabled(a === 'music-on');
          if (a === 'music-on') this.updateMusic();
          return reopen();
        }
        if (a === 'fx-on' || a === 'fx-off') {
          setFxEnabled(a === 'fx-on');
          if (this.store.hasPlayer && !this.battle) this.enterLocation();
          return reopen();
        }
        if (a === 'mute' || a === 'unmute') {
          this.setSfx(sfxVol, a === 'mute');
          return reopen();
        }
      });
    });
  }

  /** Volume e mudo dos efeitos (no save do gladiador, ou só na sessão no menu). */
  private setSfx(volume: number, muted: boolean): void {
    if (this.store.hasPlayer)
      this.store.update((p) => {
        p.settings.volume = volume;
        p.settings.muted = muted;
      });
    sound.setVolume(volume);
    sound.setMuted(muted);
  }

  // ---------------------------------------------------------------- menu principal e pausa
  private async showTitle(): Promise<void> {
    this.paused = false;
    this.view.setPaused(false);
    $('#side').hidden = true;
    $('#statusbar').hidden = true;
    this.view.showLocation({ visual: { appearance: { skin: 0, hairStyle: 0, hairColor: 0, beard: false, clothColor: 0 }, gear: {} }, location: 'arena', bg: 'bg:arena_rome', crowd: 'bg:crowd_rome', outdoor: true, hideHero: true });
    music.play('menu');
    await this.title.show();
  }

  private async playSlot(slot: number, info: SlotInfo): Promise<void> {
    this.slot = slot;
    this.chanceCache.clear();
    if (!info.player) {
      if (info.data === null && info.error) return;
      this.title.hide();
      this.startIntro();
      return;
    }
    const loaded = await this.store.load();
    if (!loaded.player) {
      toast(loaded.notice ?? t('err.loadFailed', { error: '?' }), 'bad', 8000);
      return;
    }
    this.title.hide();
    if (loaded.player.settings.language !== getLang()) this.store.update((p) => (p.settings.language = getLang()));
    this.applySettings();
    this.enterLocation();
    toast(loaded.notice ?? t('app.welcomeBack', { name: loaded.player.name }), loaded.notice ? 'info' : 'gold', 5000);
  }

  private async deleteSlot(slot: number): Promise<boolean> {
    const ok = await confirmModal(t('opt.resetTitle'), t('title.deleteBody', { n: slot }), t('title.delete'));
    if (!ok) return false;
    await bridge.save.remove(slot);
    return true;
  }

  private quit(): void {
    if (this.store.hasPlayer) this.store.flushSync();
    bridge.app.quit();
  }

  /** Esc: pausa o jogo (a luta congela) e mostra o menu de pausa. */
  private openPause(): void {
    if (this.paused) return;
    this.paused = true;
    this.view.setPaused(true);
    const m = openModal(
      `<h2 class="center">${t('pause.title')}</h2>
      <div class="pause-menu">
        <button class="btn btn-gold wide" data-p="resume">${t('pause.resume')}</button>
        <button class="btn wide" data-p="options">${t('app.options')}</button>
        <button class="btn wide" data-p="menu">${t('pause.toMenu')}</button>
        <button class="btn btn-dark wide" data-p="quit">${t('pause.quit')}</button>
      </div>
      <p class="tiny dim center">${t('pause.hint')}</p>`,
      { cls: 'modal-pause', onClose: () => this.resume() },
    );
    m.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('[data-p]')?.getAttribute('data-p');
      if (a === 'resume') closeModal();
      else if (a === 'options') {
        this.paused = true;
        closeModal();
        this.paused = true;
        this.view.setPaused(true);
        this.openOptions(() => {
          this.paused = false;
          this.openPause();
        });
      } else if (a === 'menu') void this.backToMenu();
      else if (a === 'quit') this.quit();
    });
  }

  private resume(): void {
    this.paused = false;
    this.view.setPaused(false);
  }

  private async backToMenu(): Promise<void> {
    closeModal();
    await this.store.flush();
    this.battle = null;
    this.hud.hide();
    this.root.classList.remove('in-battle');
    this.store.reset();
    this.intro?.close();
    this.intro = null;
    await this.showTitle();
  }

  private lastRecover = 0;

  /** Se o laço do Phaser parou por causa de um erro, religa (no máximo a cada 2 s). */
  private recoverLoop(): void {
    const loop = this.view?.game.loop;
    if (!loop || this.paused || Date.now() - this.lastRecover < 2000) return;
    const f0 = loop.frame;
    setTimeout(() => {
      if (loop.frame !== f0 || this.paused) return;
      this.lastRecover = Date.now();
      loop.sleep();
      loop.wake();
    }, 400);
  }

  /** Música conforme o lugar e a hora (arena, taverna, noite, cidade). */
  private updateMusic(): void {
    if (this.title?.visible) return music.play('menu');
    if (this.battle) return music.play('arena');
    if (!this.store.hasPlayer) return music.play('city');
    const p = this.store.state;
    if (p.location === 'tavern' && this.view.scene === 'hub') return music.play('tavern');
    if (p.minutes >= 20 * 60 || p.minutes < 6 * 60) return music.play('night');
    music.play('city');
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
        this.enterLocation();
        sound.play('levelup');
        toast(t('app.arrived', { name: p.name }), 'gold');
        setTimeout(() => this.readEdition(p.day), 900);
      },
      (l) => this.changeLang(l),
    );
    this.view.showLocation({ visual: preview({ skin: 0, hairStyle: 0, hairColor: 0, beard: false, clothColor: 0 }), location: 'ludus', bg: 'bg:ludus', outdoor: true });
    this.intro.start();
    music.play('city');
  }

  // ---------------------------------------------------------------- locais e mapa
  /** Mostra o local atual do gladiador (cena + painel). */
  private enterLocation(): void {
    const p = this.store.state;
    const loc = getLocation(p.location);
    const visual = playerCombatant(p).visual;
    if (loc.id === 'arena') {
      const arena = arenaForOpponent(p.selectedOpponent);
      this.view.showLocation({ visual, location: 'arena', bg: arena.bg, crowd: arena.crowd, outdoor: true, festival: isFestival(p.day), heroLook: playerPortraitKey(p) });
    } else {
      this.view.showLocation({
        visual,
        location: loc.id,
        bg: loc.bg,
        outdoor: loc.outdoor,
        busy: isOpen(loc, p.minutes, p.day),
        upgrades: p.upgrades,
        festival: isFestival(p.day),
        merchant: isMerchantDay(p.createdAt, p.day),
        armNight: isArmNight(p.day, p.minutes),
        injured: !!p.injury,
        heroLook: playerPortraitKey(p),
        openNow: () => this.store.hasPlayer && isOpen(loc, this.store.state.minutes, this.store.state.day),
        rainyDay: weatherOfDay(p.createdAt, p.day).rainy,
        minutes: p.minutes,
      });
    }
    $('#side').hidden = false;
    $('#statusbar').hidden = false;
    this.root.classList.remove('in-battle');
    this.setScreen(loc.id);
    this.renderStatus();
    this.updateMusic();
    requestAnimationFrame(() => this.updateLayout());
  }

  private setScreen(id: ScreenId): void {
    this.screen = id;
    this.root.classList.toggle('on-map', id === 'map');
    if (this.store.hasPlayer) this.screens[id].onOpen?.(this.store.state);
    this.root.querySelectorAll('[data-nav]').forEach((t) => t.classList.toggle('active', t.getAttribute('data-nav') === id));
    this.renderPanel(true);
  }

  open(id: ScreenId): void {
    if (!this.store.hasPlayer || this.battle) return;
    const p = this.store.state;
    if (id === 'map') {
      this.view.showMap(p.location, (to) => this.travel(to));
      this.setScreen('map');
      return;
    }
    if ((LOCATION_IDS as string[]).includes(id)) {
      if (id !== p.location) return this.travel(id as LocationId);
      if (this.view.scene !== 'hub') return this.enterLocation();
      return this.setScreen(id);
    }
    this.setScreen(id);
  }

  travel(to: LocationId): void {
    if (this.busy || this.battle) return;
    const p = this.store.state;
    if (to === p.location) return this.enterLocation();
    const err = canTravel(p, to);
    if (err) {
      sound.play('error');
      return toast(err, 'bad');
    }
    this.busy = true;
    if (this.view.scene !== 'map') this.view.showMap(p.location, (t) => this.travel(t));
    sound.play('step');
    this.view.travelOnMap(to, () => {
      this.busy = false;
      this.store.update((pl) => travel(pl, to));
      const loc = getLocation(to);
      if (!isOpen(loc, this.store.state.minutes, this.store.state.day)) toast(t('app.closedNow', { place: locationName(loc.id), hours: hoursLabel(loc, this.store.state.day) }), 'info');
      this.enterLocation();
    });
  }

  sleep(): void {
    if (this.busy || this.store.state.location !== 'home') return;
    this.busy = true;
    const apply = () => {
      let noShow = false;
      const edition = this.store.update((p) => {
        const rng = createRng(randomSeed());
        // torneio largado no meio e inscrição esquecida
        if (p.tournament.run) {
          abandonTournament(p);
          const r = closeTournament(p, rng);
          if (r) onEvent(p, r.reached === 3 ? 'tourneyWin' : 'tourneyOut', rng, { opp: r.champion === 'player' ? '' : r.champion });
        }
        sleep(p);
        if (checkNoShow(p)) {
          onEvent(p, 'tourneyNoShow', rng);
          noShow = true;
        }
        const fled = expireRematch(p);
        if (fled) onEvent(p, 'rematchFled', rng, { opp: fled });
        return publish(p, rng);
      });
      void this.store.flush();
      this.busy = false;
      this.renderPanel();
      if (noShow) toast(t('tour.noShowToast'), 'bad', 5000);
      if (edition) setTimeout(() => this.readEdition(edition.day), 1800);
    };
    if (!this.view.playSleep(this.store.state.day + 1, apply)) apply();
  }

  nap(): void {
    const err = this.store.update((p) => nap(p));
    if (err) toast(err, 'bad');
    else toast(t('home.napped'), 'good');
  }

  bathe(): void {
    const err = this.store.update((p) => bathe(p));
    if (err) {
      sound.play('error');
      toast(err, 'bad');
    } else {
      sound.play('coin');
      toast(t('baths.done'), 'good');
    }
  }

  /** Ações da taverna: comer e ouvir boatos (vinho). Os fregueses falam quando clicados na cena. */
  tavern(action: 'eat' | 'rumor'): void {
    if (this.busy) return;
    const screen = this.screens.tavern as TavernScreen;
    const rng = createRng(randomSeed());
    if (action === 'eat') {
      const err = this.store.update((p) => eat(p));
      if (err) return (sound.play('error'), toast(err, 'bad'));
      sound.play('coin');
      const line = npcLine('keeperServe', Math.floor(rng() * 1000));
      screen.last = { who: t('tavern.keeperName'), text: line };
      this.view.npcSay('keeper', line);
      toast(t('tavern.ate'), 'good');
    } else if (action === 'rumor') {
      const r = this.store.update((p) => hearRumor(p, rng));
      if (r.error) return (sound.play('error'), toast(r.error, 'bad'));
      sound.play('coin');
      const text = variant(tk(`rumor.${r.rivalId}`), Math.floor(rng() * 1000));
      screen.last = { who: t('tavern.quintusName'), text };
      this.view.npcSay('quintus', text);
      toast(t('tavern.rumorHeard'), 'gold', 4000);
    }
    this.renderPanel();
  }

  readEdition(day: number): void {
    if (!this.store.hasPlayer) return;
    const ed = this.store.state.news.editions.find((e) => e.day === day);
    if (!ed) return;
    if (!ed.read) this.store.update(() => (ed.read = true));
    sound.play('equip');
    const m = openModal(newspaperHtml(ed), { cls: 'modal-news' });
    m.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-np="close"]')) closeModal();
    });
  }

  // ---------------------------------------------------------------- AppActions
  get training(): boolean {
    return this.busy;
  }

  rerender(): void {
    this.renderPanel();
  }

  refreshVisual(): void {
    if (this.store.hasPlayer && !this.battle) this.view.updateVisual(playerCombatant(this.store.state).visual);
  }

  winChance(def: OpponentDef): number {
    const p = this.store.state;
    const me = playerCombatant(p).spec;
    const key = `${def.id}|${def.level}|${JSON.stringify(me)}`;
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
    if (this.busy || this.battle) return;
    const p = this.store.state;
    const err = canTrain(p);
    if (err) {
      sound.play('error');
      return toast(err, 'bad');
    }
    const apply = () => {
      this.busy = false;
      const r = this.store.update((pl) => {
        const res = doTrain(pl, id);
        if (res.ok) applyTraining(pl);
        return res;
      });
      if (!r.ok) {
        toast(r.message, 'bad');
        sound.play('error');
        this.renderPanel();
        return;
      }
      toast(r.attributeGained ? t('train.attrGained') : t('train.done', { xp: r.xp }), r.attributeGained ? 'gold' : 'good');
      this.view.showGain(r.attributeGained ? t('train.attrGained') : `+${r.xp} XP`);
      if (r.attributeGained) sound.play('levelup');
      if (r.levelUps) {
        sound.play('levelup');
        // o doctore particular (comprado no mercado) comenta cada nível ganho no treino
        if (this.store.state.upgrades.includes('doctore')) {
          this.view.npcSay('doctore', npcLine('doctoreLevel', Math.floor(Math.random() * 1000), { name: this.store.state.name, level: this.store.state.level }));
        }
        toast(t('app.levelUp', { level: this.store.state.level, points: r.levelUps * 3, skill: r.levelUps }), 'gold', 5000);
      }
    };
    this.busy = true;
    this.renderPanel();
    if (!this.view.playTraining(id, apply)) apply();
  }

  // ---------------------------------------------------------------- batalha
  /** Monta a luta conforme o modo (escada/revanche, desafiante avulso ou torneio). */
  private prepareFight(p: PlayerState, opts: { mode?: FightMode; opponentId?: string }): { def: OpponentDef; mode: FightMode; arena: ArenaDef; voice: string; intro: TalkMoment } | string {
    const cityArena = arenaForOpponent(nextRival(p).id);
    if (opts.mode === 'tournament') {
      const run = p.tournament.run;
      const m = run ? playerMatch(run) : null;
      if (!m) return t('tour.noMatch');
      if (p.energy < TOURNAMENT_ENERGY) return t('cal.noEnergyFight', { n: TOURNAMENT_ENERGY });
      if (!timeForFight(p)) return t('cal.tooLate');
      return { def: m.opponent, mode: 'tournament', arena: cityArena, voice: 'pool', intro: 'intro' };
    }
    const err = canFight(p);
    if (err) return err;
    if (opts.mode === 'free') return { def: todaysChallenger(p), mode: 'free', arena: cityArena, voice: 'pool', intro: 'intro' };
    const base = getOpponent(opts.opponentId ?? p.selectedOpponent);
    if (!base) return t('arena.unavailable');
    const lerr = ladderCheck(p, base.id);
    if (lerr) return lerr;
    return { def: fightDef(p, base), mode: rematchActive(p, base.id) ? 'rematch' : 'ladder', arena: arenaForOpponent(base.id), voice: base.id, intro: introMoment(p, base.id) };
  }

  startBattle(opts: { mode?: FightMode; opponentId?: string; injuredOk?: boolean } = {}): void {
    if (this.battle || this.busy || !this.store.hasPlayer) return;
    const p = this.store.state;
    const fight = this.prepareFight(p, opts);
    if (typeof fight === 'string') {
      sound.play('error');
      return toast(fight, 'bad', 5000);
    }
    // ferido: avisa antes (menos vida e menos dano)
    if (p.injury && !opts.injuredOk) {
      void confirmModal(t('injury.fightTitle'), t('injury.fightBody', { n: p.injury.days }), t('injury.fightAnyway')).then((ok) => {
        if (ok) this.startBattle({ ...opts, injuredOk: true });
      });
      return;
    }
    closeModal();
    const me = playerCombatant(p);
    const them = opponentCombatant(fight.def);
    this.battle = { opponent: fight.def, mode: fight.mode, strategy: p.strategy, engine: null };
    this.root.classList.add('in-battle');
    $('#side').hidden = true;
    $('#statusbar').hidden = true;
    this.updateLayout();
    music.play('arena');
    this.view.startBattle(
      {
        fighters: [me, them],
        arena: fight.arena,
        seed: randomSeed(),
        speed: p.settings.battleSpeed,
        festival: isFestival(p.day),
        talk: { opponentId: fight.voice, playerName: p.name, intro: fight.intro, portrait: fight.def.id, player: playerPortraitKey(p) },
      },
      {
        onReady: (engine) => {
          if (!this.battle) return;
          this.battle.engine = engine;
          this.hud.show(engine, this.store.state.settings.battleSpeed, [p.level, fight.def.level]);
        },
        onEvent: (e, engine) => this.hud.event(e, engine),
        onFrame: (engine) => this.hud.update(engine),
        onEnd: (res) => this.finishBattle(res),
        onSpeedReset: () => this.hud.setSpeed(1),
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
    const ok = await confirmModal(t('battle.forfeitTitle'), t('battle.forfeitBody'), t('battle.forfeit'));
    if (ok) this.view.forfeit();
  }

  private finishBattle(res: CombatResult): void {
    const ctx = this.battle;
    if (!ctx) return;
    const won = res.winner === 0;
    const rng = createRng(randomSeed());
    if (ctx.mode === 'tournament') {
      const injury = this.store.update((p) => {
        const inj = recordFightOnly(p, ctx.opponent, won, res.reason, res.duration, ctx.strategy, rng);
        recordPlayerFight(p, won);
        return inj;
      });
      void this.store.flush();
      this.exitBattle();
      if (injury) toast(t('injury.got', { n: injury }), 'bad', 5000);
      setTimeout(() => this.showBracket(), 400);
      return;
    }
    const rw = this.store.update((p) => {
      applyFight(p);
      if (ctx.mode === 'free') {
        if (p.events.freeDay !== p.day) p.events = { ...p.events, freeDay: p.day, freeCount: 0 };
        p.events.freeCount++;
      }
      return applyBattleResult(p, { opponent: ctx.opponent, won, reason: res.reason, duration: res.duration, strategy: ctx.strategy, rng, mode: ctx.mode });
    });
    this.chanceCache.clear();
    void this.store.flush();
    if (rw.levelUps) setTimeout(() => sound.play('levelup'), 600);
    if (rw.coins) sound.play('coin');
    const p = this.store.state;
    // revanche só quando o adversário pede: "lutar de novo" existe apenas para tentar
    // de novo quem ainda não foi vencido, ou para enfrentar o próximo desafiante avulso
    const again = ctx.mode === 'free' ? 'free' : ctx.mode === 'ladder' && !won ? 'retry' : null;
    const m = openModal(resultHtml(res, rw, ctx.opponent, again, p.energy), {
      cls: 'modal-result',
      onClose: () => {
        if (this.battle) this.exitBattle();
      },
    });
    m.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('[data-r]')?.getAttribute('data-r');
      if (!a) return;
      if (a === 'again') this.fightAgain(ctx.mode === 'free' ? { mode: 'free' } : { mode: 'ladder', opponentId: ctx.opponent.id });
      else if (a === 'points') {
        closeModal();
        this.open('gladiator');
      } else closeModal();
    });
  }

  private fightAgain(opts: { mode: FightMode; opponentId?: string }): void {
    const err = canFight(this.store.state);
    if (err) {
      sound.play('error');
      return toast(err, 'bad', 5000);
    }
    this.battle = null;
    closeModal();
    this.hud.hide();
    this.startBattle(opts);
  }

  private exitBattle(): void {
    this.battle = null;
    this.hud.hide();
    if (this.store.hasPlayer) this.enterLocation();
  }

  // ---------------------------------------------------------------- torneio e eventos
  tournament(action: 'register' | 'start' | 'bracket'): void {
    if (!this.store.hasPlayer || this.battle) return;
    if (action === 'register') {
      const err = this.store.update((p) => register(p));
      if (err) return (sound.play('error'), toast(err, 'bad'));
      sound.play('coin');
      toast(t('tour.registeredToast', { day: this.store.state.tournament.registered }), 'gold', 5000);
      return;
    }
    if (action === 'start') {
      const err = this.store.update((p) => startTournament(p));
      if (err) return (sound.play('error'), toast(err, 'bad'));
      sound.play('horn');
    }
    this.showBracket();
  }

  private showBracket(): void {
    const p = this.store.state;
    const run = p.tournament.run;
    if (!run) return;
    void playerPortrait(p.appearance, playerHelmet(p)).then((pic) => {
      const m = openModal(bracketHtml(p, run, pic), { cls: 'modal-bracket' });
      m.addEventListener('click', (e) => {
        const a = (e.target as HTMLElement).closest('[data-t]')?.getAttribute('data-t');
        if (a === 'close') closeModal();
        if (a === 'fight') this.startBattle({ mode: 'tournament' });
        if (a === 'claim') this.claimTournament();
      });
    });
  }

  private claimTournament(): void {
    const rng = createRng(randomSeed());
    const pr = this.store.update((p) => {
      const r = closeTournament(p, rng);
      if (r) onEvent(p, r.reached === 3 ? 'tourneyWin' : r.reached === 2 ? 'tourneyFinal' : 'tourneyOut', rng, { opp: r.champion === 'player' ? '' : r.champion });
      return r;
    });
    closeModal();
    if (!pr) return;
    sound.play(pr.reached === 3 ? 'victory' : 'coin');
    toast(t(`tour.toast${pr.reached}` as 'tour.toast0', { coins: pr.coins, fame: pr.fame }), pr.reached === 3 ? 'gold' : 'info', 6000);
    if (pr.itemId) {
      const item = getItem(pr.itemId);
      if (item) toast(t('tour.trophy', { name: itemName(item) }), 'gold', 6000);
    }
    if (pr.levelUps) toast(t('app.levelUp', { level: this.store.state.level, points: pr.levelUps * 3, skill: pr.levelUps }), 'gold', 5000);
    void this.store.flush();
  }

  async armWrestle(): Promise<void> {
    if (this.busy || !this.store.hasPlayer) return;
    const p = this.store.state;
    const err = canArmWrestle(p);
    if (err) return (sound.play('error'), toast(err, 'bad'));
    this.busy = true;
    const won = await playArmWrestle(armSetup(p), p.name);
    const rng = createRng(randomSeed());
    const r = this.store.update((pl) => {
      const res = finishArmWrestle(pl, won);
      if (won) onEvent(pl, 'armWin', rng);
      return res;
    });
    this.busy = false;
    void this.store.flush();
    const line = npcLine(won ? 'armCheer' : 'armTease', Math.floor(rng() * 1000));
    this.view.npcSay('patron', line);
    toast(won ? t('event.armWonToast', { coins: r.coins, fame: r.fame }) : t('event.armLostToast'), won ? 'gold' : 'info', 5000);
    this.renderPanel();
  }

  seeMedic(): void {
    const err = this.store.update((p) => seeMedic(p));
    if (err) return (sound.play('error'), toast(err, 'bad'));
    sound.play('guard');
    this.view.npcSay('medic', npcLine('medicDone', Math.floor(Math.random() * 1000)));
    toast(t('injury.healed'), 'good', 4000);
  }

  smithSay(text: string): void {
    this.view.npcSay('smith', text);
  }

  // ---------------------------------------------------------------- renderização
  private onStateChange(): void {
    this.applySettings();
    if (!this.battle) this.updateMusic();
    this.renderStatus();
    this.view?.refreshMap();
    if (!this.battle) this.renderPanel();
  }

  private renderStatus(): void {
    if (!this.store.hasPlayer) return;
    const p = this.store.state;
    const tod = dayFraction(p.minutes);
    const unread = unreadCount(p);
    const late = p.minutes >= 22 * 60;
    $('#statusbar').innerHTML = `
      <div class="status panel">
        <div class="row between"><b class="st-name">${esc(p.name)}</b><span class="lvl">${t('common.level', { n: p.level })}</span></div>
        ${p.level < MAX_LEVEL ? bar(p.xp, xpToNext(p.level), 'xp') : `<div class="tiny gold">${t('common.maxLevel')}</div>`}
        <div class="row between st-day"><span>${t('status.day', { weekday: weekdayName(p.day), day: p.day })}</span><span id="clock">${phaseName(tod)} ${clockLabel(tod)}</span></div>
        ${weatherLabel(worldWeather.now()) ? `<div class="weather">${weatherLabel(worldWeather.now())}</div>` : ''}
        <div class="energy-row"><span>${t('common.energy')}</span>${bar(p.energy, 100, 'energy')}</div>
        <div class="row st-res"><span title="${t('common.coins')}">${icon('coin')} ${p.coins}</span><span title="${t('common.fame')}">${icon('laurel')} ${p.reputation}</span></div>
        ${late ? `<div class="late">${t('status.late')}</div>` : ''}
        ${unread ? `<button class="btn btn-dark wide sm" data-st="news">${t('status.news')}</button>` : ''}
        ${p.unspentPoints ? `<button class="btn btn-gold wide sm" data-st="points">${t('status.attrPoints', { n: p.unspentPoints })}</button>` : ''}
        ${p.skillPoints ? `<button class="btn btn-gold wide sm" data-st="temple">${t('status.skillPoints', { n: p.skillPoints })}</button>` : ''}
      </div>`;
    const sb = $('#statusbar');
    sb.querySelector('[data-st="points"]')?.addEventListener('click', () => this.open('gladiator'));
    sb.querySelector('[data-st="temple"]')?.addEventListener('click', () => this.open('temple'));
    sb.querySelector('[data-st="news"]')?.addEventListener('click', () => {
      const ed = p.news.editions.find((e) => !e.read);
      if (ed) this.readEdition(ed.day);
    });
  }

  private renderPanel(resetScroll = false): void {
    if (!this.store.hasPlayer) return;
    const panel = $('#panel');
    const scroll = resetScroll ? 0 : panel.scrollTop;
    const p = this.store.state;
    const screen = this.screens[this.screen];
    const isSheet = this.screen === 'gladiator' || this.screen === 'history';
    const tip = p.settings.tipsSeen.includes(screen.id)
      ? ''
      : `<div class="tip">${esc(screen.tip)} <button class="btn sm" data-action="tip-ok" data-id="${screen.id}">OK</button></div>`;
    const loc = (LOCATION_IDS as string[]).includes(this.screen) ? getLocation(this.screen as LocationId) : null;
    const closed = loc && !isOpen(loc, p.minutes, p.day) ? `<div class="closed-note">${t('status.closedNow', { hours: hoursLabel(loc, p.day) })}</div>` : '';
    const head = `<div class="panel-head"><h2>${esc(screen.title)}</h2>${isSheet ? `<button class="btn sm" data-action="back">${t('common.back')}</button>` : ''}</div>`;
    panel.innerHTML = `${head}${tip}${closed}${screen.render(p)}`;
    panel.scrollTop = scroll;
  }
}
