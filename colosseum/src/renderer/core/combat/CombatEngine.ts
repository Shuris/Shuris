// Motor de combate automático — simulação determinística em passos fixos.
// Não conhece Phaser nem DOM: a cena apenas lê o estado e os eventos emitidos.
import type { SkillId } from '../model/types';
import { SKILLS, STRATEGIES, type StrategyDef } from '../data/skills';
import { createRng, type Rng } from '../systems/rng';
import {
  blockEfficiency,
  computeDamage,
  counterChance,
  counterMul,
  dodgeChance,
  fortifyDuration,
  fortifyMultiplier,
  hitChance,
  powerStrikeMul,
  quickStrikeMul,
} from './CombatResolver';
import type {
  ActionKind,
  AttackKind,
  CombatantSpec,
  CombatEvent,
  CombatOptions,
  CombatResult,
  FighterState,
  ImpactOutcome,
  Side,
} from './CombatTypes';

export const TICK = 0.05;
export const ARENA_MIN_X = 96;
export const ARENA_MAX_X = 544;
export const ENTRY_X: [number, number] = [56, 584];
export const START_X: [number, number] = [262, 378];
export const BODY_GAP = 18;
export const DEFAULT_TIME_LIMIT = 120;
export const DEFAULT_INTRO = 3.5;

const ATTACK_COST = 9;
const DODGE_COST = 9;
const BLOCK_START_COST = 2;
const EXHAUST_DURATION = 1.8;

interface AttackProfile {
  windup: number;
  recover: number;
  intervalMul: number;
  defendable: boolean;
  skill: SkillId | null;
}

const PROFILES: Record<AttackKind, AttackProfile> = {
  normal: { windup: 0.38, recover: 0.32, intervalMul: 1, defendable: true, skill: null },
  power_strike: { windup: 0.65, recover: 0.45, intervalMul: 1.3, defendable: true, skill: 'power_strike' },
  quick_strike: { windup: 0.18, recover: 0.18, intervalMul: 0.55, defendable: true, skill: 'quick_strike' },
  counter: { windup: 0.16, recover: 0.3, intervalMul: 0.8, defendable: false, skill: 'counter' },
};

const FREE_ACTIONS: ReadonlySet<ActionKind> = new Set(['idle', 'advance', 'retreat']);
const VULNERABLE_ACTIONS: ReadonlySet<ActionKind> = new Set(['recover', 'hitstun', 'exhausted', 'buff']);

export class CombatEngine {
  readonly fighters: [FighterState, FighterState];
  time = 0;
  finished = false;
  started = false;
  result: CombatResult | null = null;
  readonly timeLimit: number;
  readonly introDuration: number;
  private readonly rng: Rng;
  private events: CombatEvent[] = [];
  private tickCount = 0;

  constructor(a: CombatantSpec, b: CombatantSpec, opts: CombatOptions) {
    this.rng = createRng(opts.seed);
    this.timeLimit = opts.timeLimit ?? DEFAULT_TIME_LIMIT;
    this.introDuration = opts.introDuration ?? DEFAULT_INTRO;
    this.fighters = [this.makeFighter(0, a), this.makeFighter(1, b)];
  }

  private makeFighter(side: Side, spec: CombatantSpec): FighterState {
    return {
      side,
      spec,
      x: ENTRY_X[side],
      facing: side === 0 ? 1 : -1,
      hp: spec.stats.maxHp,
      stamina: spec.stats.maxStamina,
      action: 'intro',
      actionStart: 0,
      actionDuration: this.introDuration,
      attack: null,
      reaction: null,
      nextAttackAt: 0,
      cooldowns: {},
      fortifyUntil: 0,
      fortifyMul: 1,
      passiveTime: 0,
      counterQueued: false,
      secondWindUsed: false,
      counters: { attacks: 0, hits: 0, misses: 0, dodged: 0, blocked: 0, crits: 0, damageDealt: 0, skillsUsed: 0 },
    };
  }

  /** Tempo de luta decorrido (após a apresentação). */
  get fightTime(): number {
    return Math.max(0, this.time - this.introDuration);
  }

  get timeRemaining(): number {
    return Math.max(0, this.timeLimit - this.fightTime);
  }

  /** Avança um passo fixo e retorna os eventos gerados nele. */
  step(): CombatEvent[] {
    this.events = [];
    if (this.finished) return this.events;
    this.time += TICK;
    this.tickCount++;
    if (this.time < this.introDuration) {
      this.updateIntro();
      return this.events;
    }
    if (!this.started) {
      this.started = true;
      for (const f of this.fighters) {
        f.x = START_X[f.side];
        f.nextAttackAt = this.time + 0.4 + this.rng() * 0.4;
        this.setAction(f, 'idle', 0);
      }
      this.emit({ type: 'start', t: this.time });
    }
    const order: Side[] = this.tickCount % 2 === 0 ? [0, 1] : [1, 0];
    for (const s of order) this.updateFighter(this.fighters[s], this.fighters[s === 0 ? 1 : 0]);
    this.checkEnd();
    return this.events;
  }

  /** Simula a luta inteira sem renderização (testes/balanceamento). */
  runToEnd(maxSeconds = 600): CombatResult {
    while (!this.finished && this.time < maxSeconds) this.step();
    if (!this.result) this.finish(this.decisionWinner(), 'decision');
    return this.result as CombatResult;
  }

  forfeit(side: Side): void {
    if (this.finished) return;
    this.events = [];
    this.finish(side === 0 ? 1 : 0, 'forfeit');
  }

  /** Eventos gerados fora de step() (ex.: desistência). */
  drainEvents(): CombatEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ------------------------------------------------------------------ interno
  private emit(e: CombatEvent): void {
    this.events.push(e);
  }

  private strategy(f: FighterState): StrategyDef {
    return STRATEGIES[f.spec.strategy];
  }

  private setAction(f: FighterState, action: ActionKind, duration: number): void {
    const changed = f.action !== action;
    f.action = action;
    f.actionStart = this.time;
    f.actionDuration = duration;
    if (changed || duration > 0) this.emit({ type: 'action', t: this.time, side: f.side, action, duration });
  }

  private updateIntro(): void {
    const walk = this.introDuration * 0.7;
    const k = Math.min(1, this.time / walk);
    for (const f of this.fighters) {
      f.x = ENTRY_X[f.side] + (START_X[f.side] - ENTRY_X[f.side]) * k;
      if (k >= 1 && f.action === 'intro') this.setAction(f, 'idle', 0);
    }
  }

  private isFatigued(f: FighterState): boolean {
    return f.stamina < f.spec.stats.maxStamina * 0.25;
  }

  private spend(f: FighterState, amount: number): void {
    f.stamina = Math.max(0, f.stamina - amount * f.spec.stats.fatigueMul * this.strategy(f).staminaMul);
  }

  private skillReady(f: FighterState, skill: SkillId): boolean {
    return f.spec.skills.includes(skill) && (f.cooldowns[skill] ?? 0) <= this.time;
  }

  private costOf(kind: AttackKind): number {
    const p = PROFILES[kind];
    return p.skill ? SKILLS[p.skill].staminaCost : ATTACK_COST;
  }

  private regen(f: FighterState): void {
    const factors: Partial<Record<ActionKind, number>> = {
      idle: 1, advance: 0.9, retreat: 1.2, windup: 0.3, recover: 0.3, block: 0.2,
      dodge: 0, hitstun: 0.5, exhausted: 2.2, buff: 0.5,
    };
    const k = factors[f.action] ?? 0;
    f.stamina = Math.min(f.spec.stats.maxStamina, f.stamina + f.spec.stats.staminaRegen * k * TICK);
  }

  private updateFighter(f: FighterState, e: FighterState): void {
    if (f.action === 'victory' || f.action === 'defeat') return;
    this.regen(f);
    if (f.fortifyMul !== 1 && this.time >= f.fortifyUntil) {
      f.fortifyMul = 1;
      this.emit({ type: 'buffEnd', t: this.time, side: f.side });
    }
    const elapsed = this.time - f.actionStart;
    const dir = (Math.sign(e.x - f.x) || f.facing) as 1 | -1;

    switch (f.action) {
      case 'windup':
        if (f.attack && this.time >= f.attack.impactAt) this.resolveImpact(f, e);
        return;
      case 'dodge':
        this.move(f, -dir * 50 * TICK, e);
        if (elapsed >= f.actionDuration) this.setAction(f, 'idle', 0);
        return;
      case 'recover':
      case 'block':
      case 'hitstun':
      case 'buff':
      case 'exhausted':
        if (elapsed >= f.actionDuration) this.setAction(f, 'idle', 0);
        return;
      default:
        break;
    }
    f.facing = dir;
    // reação programada (bloqueio/esquiva)
    if (f.reaction) {
      if (this.time >= f.reaction.startAt) {
        const r = f.reaction;
        f.reaction = null;
        const cost = r.kind === 'dodge' ? DODGE_COST : BLOCK_START_COST;
        if (f.stamina >= cost) {
          this.spend(f, cost);
          this.setAction(f, r.kind, r.duration);
          return;
        }
      } else {
        if (f.action !== 'idle') this.setAction(f, 'idle', 0);
        return;
      }
    }
    if (f.stamina < 3) {
      this.setAction(f, 'exhausted', EXHAUST_DURATION);
      this.emit({ type: 'exhausted', t: this.time, side: f.side });
      return;
    }
    this.decide(f, e, dir, elapsed);
  }

  private decide(f: FighterState, e: FighterState, dir: 1 | -1, elapsed: number): void {
    const st = f.spec.stats;
    const strat = this.strategy(f);
    const gap = Math.abs(e.x - f.x);
    const inRange = gap <= st.reach;
    const canAttack = this.time >= f.nextAttackAt;

    // Defesa reforçada (autobuff)
    if (
      this.skillReady(f, 'iron_guard') &&
      f.fortifyMul === 1 &&
      f.hp / st.maxHp < 0.65 &&
      gap < e.spec.stats.reach + 30 &&
      f.stamina >= SKILLS.iron_guard.staminaCost
    ) {
      this.spend(f, SKILLS.iron_guard.staminaCost);
      f.cooldowns.iron_guard = this.time + SKILLS.iron_guard.cooldown;
      f.fortifyMul = fortifyMultiplier(st.technique);
      f.fortifyUntil = this.time + 0.45 + fortifyDuration(st.technique);
      f.counters.skillsUsed++;
      this.setAction(f, 'buff', 0.45);
      this.emit({ type: 'skill', t: this.time, side: f.side, skill: 'iron_guard' });
      return;
    }

    if (inRange && canAttack && f.stamina >= ATTACK_COST * 0.6) {
      let kind: AttackKind = 'normal';
      if (
        this.skillReady(f, 'quick_strike') &&
        VULNERABLE_ACTIONS.has(e.action) &&
        f.stamina >= SKILLS.quick_strike.staminaCost
      ) {
        kind = 'quick_strike';
      } else if (
        this.skillReady(f, 'power_strike') &&
        f.stamina >= SKILLS.power_strike.staminaCost &&
        f.stamina / st.maxStamina > 0.45 &&
        this.rng() < strat.powerChance
      ) {
        kind = 'power_strike';
      }
      this.startAttack(f, e, kind);
      return;
    }

    // Movimentos mantêm-se por um tempo mínimo para não "tremer".
    if ((f.action === 'advance' || f.action === 'retreat') && elapsed < f.actionDuration) {
      if (f.action === 'advance' && gap <= st.reach * 0.9) {
        this.setAction(f, 'idle', 0);
        return;
      }
      this.move(f, (f.action === 'advance' ? dir : -dir) * st.moveSpeed * (f.action === 'retreat' ? 0.75 : 1) * TICK, e);
      return;
    }

    if (!inRange) {
      const enemyOutreaches = e.spec.stats.reach > st.reach + 6;
      const wantsWait =
        (strat.caution >= 0.5 && !enemyOutreaches && f.passiveTime < 2.5) ||
        (this.isFatigued(f) && strat.caution >= 0.25 && gap > e.spec.stats.reach + 12 && f.passiveTime < 3);
      if (wantsWait) {
        f.passiveTime += TICK;
        if (f.action !== 'idle') this.setAction(f, 'idle', 0);
      } else {
        f.passiveTime = 0;
        this.setAction(f, 'advance', 0.3);
        this.move(f, dir * st.moveSpeed * TICK, e);
      }
      return;
    }

    // Dentro do alcance aguardando o próximo ataque: controle de distância.
    const tooClose = st.reach > 30 && gap < st.reach * 0.6;
    const catchBreath = this.isFatigued(f) && this.rng() < strat.caution * 0.08;
    const backRoom = dir === 1 ? f.x - ARENA_MIN_X : ARENA_MAX_X - f.x;
    if ((tooClose || catchBreath) && backRoom > 12) {
      this.setAction(f, 'retreat', tooClose ? 0.3 : 0.6);
      this.move(f, -dir * st.moveSpeed * 0.75 * TICK, e);
      return;
    }
    if (f.action !== 'idle') this.setAction(f, 'idle', 0);
  }

  private move(f: FighterState, dx: number, e: FighterState): void {
    let nx = Math.min(ARENA_MAX_X, Math.max(ARENA_MIN_X, f.x + dx));
    if (Math.abs(e.x - nx) < BODY_GAP) nx = e.x - Math.sign(e.x - f.x || f.facing) * BODY_GAP;
    f.x = Math.min(ARENA_MAX_X, Math.max(ARENA_MIN_X, nx));
  }

  private startAttack(f: FighterState, e: FighterState, kind: AttackKind): void {
    const st = f.spec.stats;
    const p = PROFILES[kind];
    const strat = this.strategy(f);
    this.spend(f, this.costOf(kind));
    const windup = p.windup + (kind === 'normal' && st.reach > 30 ? 0.06 : 0);
    let damageMul = 1;
    if (kind === 'power_strike') damageMul = powerStrikeMul(st.technique) + st.powerStrikeBonus;
    else if (kind === 'quick_strike') damageMul = quickStrikeMul(st.technique);
    else if (kind === 'counter') damageMul = counterMul(st.technique);
    f.attack = {
      kind,
      startedAt: this.time,
      impactAt: this.time + windup,
      windup,
      recover: p.recover,
      damageMul,
      defendable: p.defendable,
    };
    const fatigueMul = this.isFatigued(f) ? 1.25 : 1;
    f.nextAttackAt = this.time + st.attackInterval * p.intervalMul * strat.intervalMul * fatigueMul;
    f.counters.attacks++;
    if (p.skill) {
      f.cooldowns[p.skill] = this.time + SKILLS[p.skill].cooldown;
      f.counters.skillsUsed++;
      this.emit({ type: 'skill', t: this.time, side: f.side, skill: p.skill });
    }
    this.setAction(f, 'windup', windup);
    this.emit({ type: 'attack', t: this.time, side: f.side, kind, windup });
    if (p.defendable) this.considerReaction(e, f);
  }

  private considerReaction(d: FighterState, a: FighterState): void {
    if (!FREE_ACTIONS.has(d.action) || d.reaction || !a.attack) return;
    const strat = this.strategy(d);
    let pBlock = strat.blockChance * (d.spec.stats.hasShield ? 1 : 0.55);
    let pDodge = strat.dodgeChance;
    if (a.attack.kind === 'power_strike') {
      pBlock += 0.15;
      pDodge += 0.1;
    }
    if (this.isFatigued(d)) {
      pBlock *= 0.5;
      pDodge *= 0.4;
    }
    const r = this.rng();
    const impact = a.attack.impactAt;
    if (r < pBlock) {
      const startAt = this.time + 0.08;
      d.reaction = { kind: 'block', startAt, duration: Math.max(0.2, impact - startAt) + 0.25 };
    } else if (r < pBlock + pDodge) {
      const startAt = Math.max(this.time + 0.05, impact - 0.2);
      d.reaction = { kind: 'dodge', startAt, duration: 0.45 };
    }
  }

  private resolveImpact(a: FighterState, d: FighterState): void {
    const atk = a.attack;
    if (!atk) return;
    const as = a.spec.stats;
    const ds = d.spec.stats;
    const gap = Math.abs(d.x - a.x);
    const fatigued = this.isFatigued(a);
    let outcome: ImpactOutcome;
    let damage = 0;
    let crit = false;
    let stagger = false;

    if (gap > as.reach + 8) {
      outcome = 'miss';
    } else if (this.rng() > hitChance(as, ds, fatigued, d.action === 'exhausted')) {
      outcome = 'miss';
    } else if (
      atk.defendable &&
      (d.action === 'dodge' || FREE_ACTIONS.has(d.action)) &&
      this.rng() < dodgeChance(ds, this.strategy(d), d.action === 'dodge')
    ) {
      outcome = 'dodge';
    } else {
      const blocking = atk.defendable && d.action === 'block';
      const blockEff = blocking ? blockEfficiency(ds, this.strategy(d), atk.kind === 'power_strike', as.blockPierce) : 0;
      crit = this.rng() < as.critChance;
      damage = computeDamage({
        attacker: as,
        defender: ds,
        attackerStrategy: this.strategy(a),
        damageMul: atk.damageMul,
        variance: this.rng(),
        crit,
        fatigued,
        blockEff,
        fortifyMul: d.fortifyMul,
      });
      outcome = blocking ? 'block' : 'hit';
    }

    const dirAD = Math.sign(d.x - a.x) || a.facing;
    a.counters[outcome === 'hit' ? 'hits' : outcome === 'miss' ? 'misses' : outcome === 'dodge' ? 'dodged' : 'blocked']++;
    if (damage > 0) {
      d.hp = Math.max(0, d.hp - damage);
      a.counters.damageDealt += damage;
      if (crit) a.counters.crits++;
      // Segundo fôlego (árvore de Minerva): recupera vida uma vez por luta
      if (ds.secondWind && !d.secondWindUsed && d.hp > 0 && d.hp < ds.maxHp * 0.25) {
        d.secondWindUsed = true;
        const heal = Math.round(ds.maxHp * 0.12);
        d.hp = Math.min(ds.maxHp, d.hp + heal);
        this.emit({ type: 'secondWind', t: this.time, side: d.side, heal });
      }
    }

    if (outcome === 'hit') {
      stagger = crit || damage >= ds.maxHp * 0.08 || atk.kind === 'power_strike';
      if (d.action !== 'windup' || stagger) {
        d.attack = null;
        d.reaction = null;
        this.setAction(d, 'hitstun', stagger ? 0.45 : 0.25);
      }
      this.move(d, dirAD * (stagger ? 10 : 4), a);
    } else if (outcome === 'block') {
      this.spend(d, 2 + damage * 0.5);
      this.move(d, dirAD * 3, a);
      if (d.stamina <= 0) {
        d.reaction = null;
        this.setAction(d, 'exhausted', EXHAUST_DURATION);
        this.emit({ type: 'exhausted', t: this.time, side: d.side });
      }
    } else if (outcome === 'dodge') {
      this.move(d, dirAD * 8, a);
    }

    this.emit({ type: 'impact', t: this.time, side: a.side, target: d.side, kind: atk.kind, outcome, damage, crit, stagger });
    a.attack = null;
    this.setAction(a, 'recover', atk.recover);

    // Contra-ataque após bloqueio/esquiva
    if (
      (outcome === 'block' || outcome === 'dodge') &&
      d.hp > 0 &&
      d.action !== 'exhausted' &&
      this.skillReady(d, 'counter') &&
      d.stamina >= SKILLS.counter.staminaCost &&
      this.rng() < counterChance(ds.technique)
    ) {
      d.reaction = null;
      this.startAttack(d, a, 'counter');
    }
  }

  private decisionWinner(): Side {
    const [a, b] = this.fighters;
    const pa = a.hp / a.spec.stats.maxHp;
    const pb = b.hp / b.spec.stats.maxHp;
    if (Math.abs(pa - pb) > 1e-6) return pa > pb ? 0 : 1;
    return a.counters.damageDealt >= b.counters.damageDealt ? 0 : 1;
  }

  private checkEnd(): void {
    const [a, b] = this.fighters;
    if (a.hp <= 0 || b.hp <= 0) {
      const winner: Side = a.hp <= 0 && b.hp <= 0 ? this.decisionWinner() : a.hp <= 0 ? 1 : 0;
      this.finish(winner, 'ko');
    } else if (this.fightTime >= this.timeLimit) {
      this.finish(this.decisionWinner(), 'decision');
    }
  }

  private finish(winner: Side, reason: 'ko' | 'decision' | 'forfeit'): void {
    this.finished = true;
    const w = this.fighters[winner];
    const l = this.fighters[winner === 0 ? 1 : 0];
    w.attack = l.attack = null;
    w.reaction = l.reaction = null;
    this.setAction(w, 'victory', 0);
    this.setAction(l, 'defeat', 0);
    this.result = {
      winner,
      reason,
      duration: this.fightTime,
      fighters: [this.summary(this.fighters[0]), this.summary(this.fighters[1])],
    };
    this.emit({ type: 'end', t: this.time, winner, reason });
  }

  private summary(f: FighterState) {
    return { name: f.spec.name, hp: f.hp, maxHp: f.spec.stats.maxHp, counters: { ...f.counters } };
  }
}
