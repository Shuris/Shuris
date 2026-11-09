// Controlador principal da interface: liga a UI (DOM), o estado (GameStore),
// a camada visual (Phaser) e a janela desktop (bridge/IPC).
import type { WindowState } from '../../shared/ipc';
import { GameStore } from '../core/GameStore';
import type { Appearance, PlayerState, TrainingId } from '../core/model/types';
import { CombatEngine } from '../core/combat/CombatEngine';
import type { CombatEngine as Engine } from '../core/combat/CombatEngine';
import type { CombatResult } from '../core/combat/CombatTypes';
import { opponentCombatant, playerCombatant, type FighterVisual } from '../core/combat/CombatantFactory';
import { getOpponent, type OpponentDef } from '../core/data/opponents';
import { getItem } from '../core/data/equipment';
import { applyBattleResult, isUnlocked, xpToNext } from '../core/systems/ProgressionSystem';
import { createPlayer } from '../core/systems/PlayerFactory';
import { train as doTrain, trainingCost } from '../core/systems/TrainingSystem';
import { createRng, randomSeed } from '../core/systems/rng';
import { MAX_LEVEL } from '../core/data/gladiators';
import { bridge, isElectron } from '../platform/bridge';
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
  engine: Engine | null;
}

export class App implements AppActions {
  readonly store = new GameStore({
    read: () => bridge.save.read(),
    write: (d) => bridge.save.write(d),
    writeSync: (d) => bridge.save.writeSync(d),
  });
  private view!: GameView;
  private screens: Record<TabId, Screen>;
  private tab: TabId = 'arena';
  private win: WindowState | null = null;
  private battle: BattleCtx | null = null;
  private hud!: BattleHud;
  private intro: IntroScreen | null = null;
  private trainingBusy = false;
  private autoTimer: ReturnType<typeof setInterval> | null = null;
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
    this.store.onSaveError = (msg) => toast(`Falha ao salvar o progresso: ${msg}`, 'bad', 6000);
    this.store.subscribe(() => this.onStateChange());

    const [_, winState, loaded] = await Promise.all([this.view.ready, bridge.win.getState(), this.store.load()]);
    void _;
    this.applyWindowState(winState);
    bridge.win.onState((s) => this.applyWindowState(s));
    $('#loading').remove();

    if (loaded.player) {
      this.enterHub();
      if (loaded.notice) toast(loaded.notice, 'info', 6000);
      else toast(`Bem-vindo de volta, ${loaded.player.name}!`, 'gold');
    } else {
      if (loaded.notice) toast(loaded.notice, 'bad', 8000);
      this.startIntro();
    }
    window.addEventListener('beforeunload', () => this.store.flushSync());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && hasModal()) closeModal();
    });
    new ResizeObserver(() => this.updateLayout()).observe($('#stage'));
    (window as unknown as { __colosseum: App }).__colosseum = this; // usado pelos testes E2E
  }

  private shellHtml(): string {
    const tabs: Array<[TabId, string]> = [
      ['arena', 'Arena'],
      ['gladiator', 'Gladiador'],
      ['training', 'Treinamento'],
      ['equipment', 'Equipamentos'],
      ['history', 'Histórico'],
    ];
    return `
      <header id="titlebar">
        <img src="assets/ui/app-icon.png" alt="" class="tb-icon"><span class="tb-title">COLOSSEUM</span>
        <span class="tb-space"></span>
        <button class="tb-btn tb-text" data-w="options" title="Opções">Opções</button>
        <button class="tb-btn tb-text tb-comp" data-w="companion" title="Modo companion (Ctrl+Shift+M)">Modo companion</button>
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
        <div id="companion-ui">
          <div class="comp-bar">
            <span class="comp-title" id="comp-title"></span>
            <span class="tb-space"></span>
            <button class="cbtn" data-c="top" title="Sempre no topo">Topo</button>
            <button class="cbtn" data-c="click" title="Ignorar cliques do mouse (Ctrl+Shift+X para voltar)">Clique</button>
            <button class="cbtn" data-c="min" title="Minimizar">&#8211;</button>
            <button class="cbtn" data-c="hide" title="Ocultar (Ctrl+Shift+H para mostrar)">Ocultar</button>
            <button class="cbtn cbtn-full" data-c="full" title="Voltar ao modo completo (Ctrl+Shift+M)">Expandir</button>
          </div>
          <div class="comp-opacity" id="comp-opacity"><span>Opacidade</span><input type="range" min="30" max="100" step="5" data-c="opacity"></div>
          <div class="comp-idle" id="comp-idle"></div>
        </div>
        <div id="clickthrough-note" hidden></div>
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
      } else if (a === 'companion') void this.setMode('companion');
      else if (a === 'options') this.openOptions();
    });
    $('#titlebar').addEventListener('dblclick', (e) => {
      if (!(e.target as HTMLElement).closest('button')) bridge.win.toggleMaximize();
    });
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
    $('#companion-ui').addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('[data-c]') as HTMLElement | null;
      if (!el || !this.win) return;
      switch (el.dataset.c) {
        case 'top':
          void bridge.win.setAlwaysOnTop(!this.win.alwaysOnTop);
          break;
        case 'click':
          void bridge.win.setClickThrough(true);
          break;
        case 'min':
          bridge.win.minimize();
          break;
        case 'hide':
          bridge.win.hide();
          break;
        case 'full':
          void this.setMode('full');
          break;
        case 'fight':
          this.startBattle();
          break;
        case 'auto':
          this.store.update((p) => (p.settings.autoContinue = !p.settings.autoContinue));
          break;
      }
    });
    $('#companion-ui').addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.dataset.c === 'opacity') void bridge.win.setOpacity(Number(el.value) / 100);
    });
  }

  // ---------------------------------------------------------------- janela / modos
  private async setMode(mode: 'full' | 'companion'): Promise<void> {
    const s = await bridge.win.setMode(mode);
    this.applyWindowState(s);
  }

  private applyWindowState(s: WindowState): void {
    const prevMode = this.win?.mode;
    this.win = s;
    const app = this.root;
    app.classList.toggle('mode-companion', s.mode === 'companion');
    app.classList.toggle('mode-full', s.mode === 'full');
    app.classList.toggle('click-through', s.clickThrough);
    app.classList.toggle('maximized', s.maximized);
    app.classList.toggle('no-electron', !isElectron);
    const top = this.root.querySelector('[data-c="top"]');
    top?.classList.toggle('active', s.alwaysOnTop);
    const op = this.root.querySelector<HTMLInputElement>('[data-c="opacity"]');
    if (op) op.value = String(Math.round(s.opacity * 100));
    $('#comp-opacity').hidden = !s.opacitySupported;
    const note = $('#clickthrough-note');
    note.hidden = !s.clickThrough;
    note.textContent = `Clique-através ativo · ${s.shortcuts.clickThrough} para desativar`;
    if (prevMode && prevMode !== s.mode) {
      if (s.mode === 'companion')
        toast(`Passe o mouse para ver os controles. ${s.shortcuts.toggleMode}: modo completo`, 'info', 4000);
      if (s.shortcutErrors.length) toast(`Atalhos indisponíveis (em uso por outro programa): ${s.shortcutErrors.join(', ')}`, 'bad', 7000);
    }
    this.renderCompanionIdle();
    this.updateLayout();
  }

  private get compact(): boolean {
    return this.win?.mode === 'companion';
  }

  private updateLayout(): void {
    if (!this.view) return;
    const stage = $('#stage').getBoundingClientRect();
    let right = 0;
    const side = $('#side');
    const create = this.root.querySelector('.intro-create .create, .intro-story .story') as HTMLElement | null;
    if (!this.compact && !this.battle && !side.hidden) right = stage.right - side.getBoundingClientRect().left + 8;
    else if (create && !this.compact) right = stage.right - create.getBoundingClientRect().left + 8;
    const top = !this.compact && this.battle ? 70 : 0;
    const bottom = !this.compact && this.battle ? 60 : this.compact && !this.battle ? 40 : 0;
    this.view.setLayout({ right, top, bottom }, this.compact);
  }

  private openOptions(): void {
    const s = this.win;
    void bridge.app.info().then((info) => {
      const m = openModal(`
        <h2>Opções</h2>
        <h3>Atalhos globais</h3>
        <ul class="howto">
          <li><b>${esc(s?.shortcuts.toggleMode ?? '')}</b> — alternar modo completo / companion</li>
          <li><b>${esc(s?.shortcuts.clickThrough ?? '')}</b> — ativar/desativar clique-através (modo companion)</li>
          <li><b>${esc(s?.shortcuts.toggleVisible ?? '')}</b> — mostrar/ocultar a janela</li>
        </ul>
        <p class="hint">O ícone do Colosseum na bandeja do sistema (perto do relógio) também permite restaurar a janela, desativar o clique-através ou sair.</p>
        <h3>Salvamento</h3>
        <p class="small">O progresso é salvo automaticamente em:<br><code>${esc(info.savePath)}</code></p>
        <p class="small dim">Versão ${esc(info.version)}</p>
        <div class="row between"><button class="btn btn-dark" data-o="reset">Apagar progresso…</button><button class="btn" data-o="close">Fechar</button></div>`);
      m.addEventListener('click', async (e) => {
        const a = (e.target as HTMLElement).closest('[data-o]')?.getAttribute('data-o');
        if (a === 'close') closeModal();
        if (a === 'reset') {
          const ok = await confirmModal('Apagar progresso', 'Isto apaga permanentemente o seu gladiador e todo o progresso. Deseja continuar?', 'Apagar tudo');
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
    let shown = false;
    this.intro = new IntroScreen(
      $('#intro'),
      (a) => {
        if (!shown) {
          this.view.showHub(preview(a));
          shown = true;
        } else this.view.updateVisual(preview(a));
        requestAnimationFrame(() => this.updateLayout());
      },
      (r) => {
        const p = createPlayer(r.name, r.origin, r.appearance);
        this.store.setPlayer(p);
        void this.store.flush();
        this.intro?.close();
        this.intro = null;
        this.enterHub();
        toast(`${p.name} chegou ao ludus!`, 'gold');
      },
    );
    this.view.showHub(preview({ skin: 0, hairStyle: 0, hairColor: 0, beard: false, clothColor: 0 }));
    shown = true;
    this.intro.start();
  }

  private enterHub(): void {
    this.view.showHub(playerCombatant(this.store.state).visual);
    $('#side').hidden = false;
    $('#statusbar').hidden = false;
    this.root.classList.remove('in-battle');
    this.goTab(this.tab);
    this.renderStatus();
    this.renderCompanionIdle();
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
        this.renderPanel();
        return;
      }
      toast(r.message, r.attributeGained ? 'gold' : 'good');
      this.view.showGain(r.attributeGained ? '+1 atributo!' : `+${r.xp} XP`);
      if (r.levelUps) toast(`Subiu para o nível ${this.store.state.level}! +${r.levelUps * 3} pontos de atributo.`, 'gold', 5000);
    };
    const p = this.store.state;
    if (p.coins < trainingCost(p, id)) return toast('Moedas insuficientes para este treinamento.', 'bad');
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
    this.renderCompanionIdle();
    this.updateLayout();
    this.view.startBattle(
      { fighters: [me, them], seed: randomSeed(), speed: p.settings.battleSpeed },
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
    const ok = await confirmModal('Render-se', 'Desistir desta luta? Ela contará como derrota (sem perder itens ou níveis).', 'Render-se');
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
    const auto = this.store.state.settings.autoContinue;
    const m = openModal(resultHtml(res, rw, ctx.opponent, auto, this.compact), {
      cls: this.compact ? 'modal-compact' : 'modal-result',
      onClose: () => {
        if (this.battle && !this.autoPending) this.exitBattle();
      },
    });
    m.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('[data-r]')?.getAttribute('data-r');
      if (!a) return;
      if (a === 'again') {
        this.autoPending = true;
        closeModal();
        this.autoPending = false;
        this.battle = null;
        this.startBattle(ctx.opponent.id);
      } else if (a === 'points') {
        closeModal();
        this.goTab('gladiator');
      } else closeModal();
    });
    if (auto) this.scheduleAuto(m, ctx.opponent.id);
  }

  private autoPending = false;

  private scheduleAuto(modal: HTMLElement, opponentId: string): void {
    let left = 8;
    const label = modal.querySelector('[data-countdown]');
    const tick = () => {
      if (label) label.textContent = `Próxima luta em ${left}s (lutas contínuas ativas)`;
      if (left-- <= 0) {
        this.cancelAuto();
        if (!this.store.state.settings.autoContinue) return;
        this.autoPending = true;
        closeModal();
        this.autoPending = false;
        this.battle = null;
        this.startBattle(opponentId);
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
    this.renderStatus();
    this.renderCompanionIdle();
    if (!this.battle) this.renderPanel();
  }

  private renderStatus(): void {
    if (!this.store.hasPlayer) return;
    const p = this.store.state;
    const need = xpToNext(p.level);
    $('#statusbar').innerHTML = `
      <div class="status panel">
        <div class="row between"><b class="st-name">${esc(p.name)}</b><span class="lvl">Nível ${p.level}</span></div>
        ${p.level < MAX_LEVEL ? bar(p.xp, need, 'xp') : '<div class="tiny gold">Nível máximo</div>'}
        <div class="row st-res"><span title="Moedas">${icon('coin', 'sm')} ${p.coins}</span><span title="Reputação">${icon('laurel', 'sm')} ${p.reputation}</span>
        ${p.unspentPoints ? `<button class="tag gold pts" data-goto="gladiator">+${p.unspentPoints} pontos</button>` : ''}</div>
      </div>`;
    $('#statusbar')
      .querySelector('[data-goto]')
      ?.addEventListener('click', () => this.goTab('gladiator'));
    $('#comp-title').textContent = `${p.name} · Nv ${p.level}`;
  }

  private renderCompanionIdle(): void {
    const el = this.root.querySelector('#comp-idle') as HTMLElement | null;
    if (!el) return;
    if (!this.store.hasPlayer || this.battle || !this.compact) {
      el.innerHTML = '';
      return;
    }
    const p = this.store.state;
    const opp = getOpponent(p.selectedOpponent);
    el.innerHTML = `${p.level < MAX_LEVEL ? bar(p.xp, xpToNext(p.level), 'xp', false) : ''}
      <div class="row center">
        <button class="cbtn cbtn-fight" data-c="fight">Lutar: ${esc(opp?.name ?? '')}</button>
        <button class="cbtn ${p.settings.autoContinue ? 'active' : ''}" data-c="auto" title="Lutas contínuas">Contínuo</button>
      </div>`;
  }

  private renderPanel(resetScroll = false): void {
    if (!this.store.hasPlayer) return;
    const panel = $('#panel');
    const scroll = resetScroll ? 0 : panel.scrollTop;
    const p = this.store.state;
    const screen = this.screens[this.tab];
    const tip = p.settings.tipsSeen.includes(screen.id)
      ? ''
      : `<div class="tip"><b>Dica:</b> ${esc(screen.tip)} <button class="btn sm" data-action="tip-ok" data-id="${screen.id}">Entendi</button></div>`;
    panel.innerHTML = `<h2 class="panel-title">${esc(screen.title)}</h2>${tip}${screen.render(p)}`;
    panel.scrollTop = scroll;
  }
}
