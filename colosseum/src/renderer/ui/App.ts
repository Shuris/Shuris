// Controlador principal da interface: liga a UI (DOM), o estado (GameStore),
// a camada visual (Phaser), o som e a janela desktop (bridge/IPC).
import type { WindowState } from '../../shared/ipc';
import { GameStore } from '../core/GameStore';
import type { Appearance, LocationId, PlayerState, TrainingId } from '../core/model/types';
import { CombatEngine } from '../core/combat/CombatEngine';
import type { CombatResult } from '../core/combat/CombatTypes';
import { opponentCombatant, playerCombatant, type FighterVisual } from '../core/combat/CombatantFactory';
import { getOpponent, type OpponentDef } from '../core/data/opponents';
import { arenaForOpponent } from '../core/data/arenas';
import { getLocation, hoursLabel, isOpen, weekdayName } from '../core/data/locations';
import { getItem } from '../core/data/equipment';
import { applyBattleResult, isUnlocked, xpToNext } from '../core/systems/ProgressionSystem';
import { createPlayer } from '../core/systems/PlayerFactory';
import { train as doTrain } from '../core/systems/TrainingSystem';
import { applyFight, applyTraining, bathe, canFight, canTrain, canTravel, nap, sleep, travel } from '../core/systems/CalendarSystem';
import { publish, unreadCount } from '../core/systems/NewsSystem';
import { clockLabel, dayFraction, phaseName } from '../core/systems/TimeOfDay';
import { weatherAt, weatherLabel, weatherOfDay } from '../core/systems/WeatherSystem';
import { worldWeather } from '../game/DayNight';
import { createRng, randomSeed } from '../core/systems/rng';
import { MAX_LEVEL } from '../core/data/gladiators';
import { bridge, isElectron } from '../platform/bridge';
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
import { MapScreen } from './screens/MapScreen';
import { MarketScreen } from './screens/MarketScreen';
import { TempleScreen } from './screens/TempleScreen';
import { TrainingScreen } from './screens/TrainingScreen';
import type { AppActions, Screen, ScreenId } from './screens/Screen';
import { TavernScreen } from './screens/TavernScreen';
import { chat, eat, hearRumor } from '../core/systems/TavernSystem';
import { npcLine } from '../core/data/dialogue';
import { tk, variant } from '../i18n';
import { getLang, setLang, t, type Lang } from '../i18n';
import { locationName } from '../i18n/data';
import { loadLang, saveLang } from '../i18n/prefs';

interface BattleCtx {
  opponent: OpponentDef;
  strategy: PlayerState['strategy'];
  engine: CombatEngine | null;
}

const LOCATION_IDS: LocationId[] = ['ludus', 'home', 'market', 'arena', 'temple', 'forum', 'baths', 'tavern'];

export class App implements AppActions {
  readonly store = new GameStore({
    read: () => bridge.save.read(),
    write: (d) => bridge.save.write(d),
    writeSync: (d) => bridge.save.writeSync(d),
  });
  readonly sound = sound;
  /** previsão do tempo de um dia (usada pelos testes E2E) */
  readonly weatherOfDay = (day: number) => weatherOfDay(this.store.state.createdAt, day);
  private view!: GameView;
  private screens: Record<ScreenId, Screen>;
  private screen: ScreenId = 'home';
  private win: WindowState = { maximized: false, fullscreen: false };
  private battle: BattleCtx | null = null;
  private hud!: BattleHud;
  private intro: IntroScreen | null = null;
  private busy = false;
  private autoTimer: ReturnType<typeof setInterval> | null = null;
  private autoPending = false;
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
    this.store.onSaveError = (msg) => toast(t('app.saveFailed', { msg }), 'bad', 6000);
    this.store.subscribe(() => this.onStateChange());

    const [, winState, loaded] = await Promise.all([this.view.ready, bridge.win.getState(), this.store.load()]);
    this.applyWindowState(winState);
    bridge.win.onState((s) => this.applyWindowState(s));
    $('#loading').remove();

    if (loaded.player) {
      // idioma salvo no gladiador (saves antigos ficam com o idioma atual)
      if (loaded.player.settings.language !== getLang()) this.store.update((p) => (p.settings.language = getLang()));
      this.applySettings();
      this.enterLocation();
      toast(loaded.notice ?? t('app.welcomeBack', { name: loaded.player.name }), loaded.notice ? 'info' : 'gold', 5000);
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
    document.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (b && !b.disabled) sound.play('click');
    });
    new ResizeObserver(() => this.updateLayout()).observe($('#stage'));
    (window as unknown as { __colosseum: App }).__colosseum = this; // usado pelos testes E2E
  }

  private shellHtml(): string {
    return `
      <header id="titlebar">
        <img src="assets/ui/app-icon.png" alt="" class="tb-icon"><span class="tb-title">COLOSSEUM</span>
        <span class="tb-space"></span>
        <button class="tb-btn tb-text" data-w="lang" data-tt="app.langTitle">${getLang() === 'pt' ? 'EN' : 'PT'}</button>
        <button class="tb-btn tb-text" data-w="sound" data-tt="app.soundTitle">${t('app.sound')}</button>
        <button class="tb-btn tb-text" data-w="fullscreen" data-tt="app.fullscreenTitle" data-t="app.fullscreen">${t('app.fullscreen')}</button>
        <button class="tb-btn tb-text" data-w="options" data-tt="app.options" data-t="app.options">${t('app.options')}</button>
        <button class="tb-btn" data-w="min" data-tt="app.minimize">&#8211;</button>
        <button class="tb-btn" data-w="max" data-tt="app.maximize">&#9633;</button>
        <button class="tb-btn tb-close" data-w="close" data-tt="app.close">&#215;</button>
      </header>
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
        <button id="exit-fullscreen" class="btn btn-dark" hidden data-tt="app.exitFullscreenTitle" data-t="app.exitFullscreen">${t('app.exitFullscreen')}</button>
        <div id="intro" hidden></div>
        <div id="modal-root"></div>
        <div id="toast-root"></div>
        <div id="loading"><div class="loading-box">${t('app.loading')}</div></div>
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
      else if (a === 'lang') this.changeLang(getLang() === 'pt' ? 'en' : 'pt');
    });
    this.applyShellText();
    $('#titlebar').addEventListener('dblclick', (e) => {
      if (!(e.target as HTMLElement).closest('button')) bridge.win.toggleMaximize();
    });
    $('#exit-fullscreen').addEventListener('click', () => void this.setFullscreen(false));
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
    $('#exit-fullscreen').hidden = !s.fullscreen;
    if (s.fullscreen && !wasFull) toast(t('app.fullscreenToast'), 'info', 3000);
    requestAnimationFrame(() => this.updateLayout());
  }

  private applySettings(): void {
    if (!this.store.hasPlayer) return;
    const st = this.store.state.settings;
    sound.setVolume(st.volume);
    sound.setMuted(st.muted);
    const btn = this.root.querySelector('[data-w="sound"]');
    if (btn) {
      btn.textContent = st.muted ? t('app.soundOff') : t('app.soundOn');
      btn.classList.toggle('off', st.muted);
    }
  }

  private toggleMute(): void {
    if (!this.store.hasPlayer) return;
    this.store.update((p) => (p.settings.muted = !p.settings.muted));
    toast(this.store.state.settings.muted ? t('app.soundMuted') : t('app.soundUnmuted'), 'info', 1500);
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
    const lb = this.root.querySelector('[data-w="lang"]');
    if (lb) lb.textContent = getLang() === 'pt' ? 'EN' : 'PT';
  }

  private openOptions(): void {
    void bridge.app.info().then((info) => {
      const st = this.store.hasPlayer ? this.store.state.settings : null;
      const m = openModal(`
        <h2>${t('app.options')}</h2>
        <div class="opt-row"><span>${t('opt.language')}</span><button class="btn sm ${getLang() === 'pt' ? 'active' : ''}" data-o="lang-pt">Português</button><button class="btn sm ${getLang() === 'en' ? 'active' : ''}" data-o="lang-en">English</button></div>
        ${
          st
            ? `<div class="opt-row"><span>${t('opt.volume')}</span><input type="range" min="0" max="100" step="5" value="${Math.round(st.volume * 100)}" data-o="volume"></div>
        <div class="opt-row"><span>${t('opt.sound')}</span><button class="btn sm ${st.muted ? '' : 'active'}" data-o="unmute">${t('opt.on')}</button><button class="btn sm ${st.muted ? 'active' : ''}" data-o="mute">${t('opt.off')}</button></div>`
            : ''
        }
        <div class="opt-row"><span>${t('opt.screen')}</span><button class="btn sm" data-o="fullscreen">${this.win.fullscreen ? t('app.exitFullscreen') : t('opt.fullscreenF11')}</button></div>
        <p class="tiny dim">${t('opt.savedAt', { path: esc(info.savePath), version: esc(info.version) })}</p>
        <div class="row between"><button class="btn btn-dark sm" data-o="reset">${t('opt.reset')}</button><button class="btn" data-o="close">${t('common.close')}</button></div>`);
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
        if (a === 'lang-pt' || a === 'lang-en') {
          closeModal();
          this.changeLang(a === 'lang-pt' ? 'pt' : 'en');
          return this.openOptions();
        }
        if (a === 'fullscreen') {
          closeModal();
          return void this.setFullscreen(!this.win.fullscreen);
        }
        if (a === 'mute' || a === 'unmute') {
          this.store.update((p) => (p.settings.muted = a === 'mute'));
          closeModal();
          return this.openOptions();
        }
        if (a === 'reset') {
          const ok = await confirmModal(t('opt.resetTitle'), t('opt.resetBody'), t('opt.resetConfirm'));
          if (!ok) return;
          await bridge.save.remove();
          this.store.reset();
          this.chanceCache.clear();
          if (this.battle) this.exitBattle();
          $('#side').hidden = true;
          $('#statusbar').hidden = true;
          this.startIntro();
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
        this.enterLocation();
        sound.play('levelup');
        toast(t('app.arrived', { name: p.name }), 'gold');
        setTimeout(() => this.readEdition(p.day), 900);
      },
      (l) => this.changeLang(l),
    );
    this.view.showLocation({ visual: preview({ skin: 0, hairStyle: 0, hairColor: 0, beard: false, clothColor: 0 }), location: 'ludus', bg: 'bg:ludus', outdoor: true });
    this.intro.start();
  }

  // ---------------------------------------------------------------- locais e mapa
  /** Mostra o local atual do gladiador (cena + painel). */
  private enterLocation(): void {
    const p = this.store.state;
    const loc = getLocation(p.location);
    const visual = playerCombatant(p).visual;
    if (loc.id === 'arena') {
      const arena = arenaForOpponent(p.selectedOpponent);
      this.view.showLocation({ visual, location: 'arena', bg: arena.bg, crowd: arena.crowd, outdoor: true });
    } else {
      this.view.showLocation({ visual, location: loc.id, bg: loc.bg, outdoor: loc.outdoor, busy: isOpen(loc, p.minutes, p.day), upgrades: p.upgrades });
    }
    $('#side').hidden = false;
    $('#statusbar').hidden = false;
    this.root.classList.remove('in-battle');
    this.setScreen(loc.id);
    this.renderStatus();
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
      const edition = this.store.update((p) => {
        sleep(p);
        return publish(p, createRng(randomSeed()));
      });
      void this.store.flush();
      this.busy = false;
      this.renderPanel();
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

  /** Ações da taverna: comer, ouvir boatos (vinho) e conversar. */
  tavern(action: 'eat' | 'rumor' | 'talk'): void {
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
    } else {
      const err = this.store.update((p) => chat(p));
      if (err) return (sound.play('error'), toast(err, 'bad'));
      const n = Math.floor(rng() * 10);
      const who = tk(`chat.${n}.who`);
      const text = tk(`chat.${n}.text`, { name: this.store.state.name });
      const reply = tk(`chat.${n}.reply`, { name: this.store.state.name });
      const kind = who === 'quintus' ? 'quintus' : who === 'keeper' ? 'keeper' : 'patron';
      screen.last = { who: kind === 'quintus' ? t('tavern.quintusName') : kind === 'keeper' ? t('tavern.keeperName') : t('tavern.patronName'), text };
      this.view.npcSay(kind, text);
      setTimeout(() => this.view.heroSay(reply), 2200);
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
        toast(t('app.levelUp', { level: this.store.state.level, points: r.levelUps * 3, skill: r.levelUps }), 'gold', 5000);
      }
    };
    this.busy = true;
    this.renderPanel();
    if (!this.view.playTraining(id, apply)) apply();
  }

  // ---------------------------------------------------------------- batalha
  startBattle(opponentId?: string): void {
    if (this.battle || this.busy || !this.store.hasPlayer) return;
    const p = this.store.state;
    const def = getOpponent(opponentId ?? p.selectedOpponent);
    if (!def || !isUnlocked(p, def.id)) return toast(t('arena.unavailable'), 'bad');
    const err = canFight(p);
    if (err) {
      sound.play('error');
      return toast(err, 'bad', 5000);
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
      { fighters: [me, them], arena: arenaForOpponent(def.id), seed: randomSeed(), speed: p.settings.battleSpeed, talk: { opponentId: def.id, playerName: p.name } },
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
    const ok = await confirmModal(t('battle.forfeitTitle'), t('battle.forfeitBody'), t('battle.forfeit'));
    if (ok) this.view.forfeit();
  }

  private finishBattle(res: CombatResult): void {
    const ctx = this.battle;
    if (!ctx) return;
    const won = res.winner === 0;
    const rng = createRng(randomSeed());
    const rw = this.store.update((p) => {
      applyFight(p);
      return applyBattleResult(p, { opponent: ctx.opponent, won, reason: res.reason, duration: res.duration, strategy: ctx.strategy, rng });
    });
    this.chanceCache.clear();
    void this.store.flush();
    if (rw.levelUps) setTimeout(() => sound.play('levelup'), 600);
    if (rw.coins) sound.play('coin');
    const p = this.store.state;
    const auto = p.settings.autoContinue && !canFight(p);
    const m = openModal(resultHtml(res, rw, ctx.opponent, auto, p.energy), {
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
        this.open('gladiator');
      } else closeModal();
    });
    if (auto) this.scheduleAuto(m, ctx.opponent.id);
    else if (p.settings.autoContinue) toast(canFight(p) ?? '', 'info', 5000);
  }

  private rematch(opponentId: string): void {
    const err = canFight(this.store.state);
    if (err) {
      sound.play('error');
      return toast(err, 'bad', 5000);
    }
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
      if (label) label.textContent = t('result.nextIn', { s: left });
      if (left-- <= 0) {
        this.cancelAuto();
        if (this.store.state.settings.autoContinue) this.rematch(opponentId);
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
    if (this.store.hasPlayer) this.enterLocation();
  }

  // ---------------------------------------------------------------- renderização
  private onStateChange(): void {
    this.applySettings();
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
