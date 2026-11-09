import type { SkillId, StrategyId } from '../model/types';
import type { CombatStats } from '../systems/AttributeSystem';

export type Side = 0 | 1;

export interface CombatantSpec {
  name: string;
  level: number;
  stats: CombatStats;
  skills: SkillId[];
  strategy: StrategyId;
}

export type ActionKind =
  | 'intro'
  | 'idle'
  | 'advance'
  | 'retreat'
  | 'windup'
  | 'recover'
  | 'block'
  | 'dodge'
  | 'hitstun'
  | 'exhausted'
  | 'buff'
  | 'victory'
  | 'defeat';

export type AttackKind = 'normal' | 'power_strike' | 'quick_strike' | 'counter';

export interface PendingAttack {
  kind: AttackKind;
  startedAt: number;
  impactAt: number;
  windup: number;
  recover: number;
  damageMul: number;
  /** ataque pode ser bloqueado/esquivado */
  defendable: boolean;
}

export interface PendingReaction {
  kind: 'block' | 'dodge';
  startAt: number;
  duration: number;
}

export interface FighterCounters {
  attacks: number;
  hits: number;
  misses: number;
  dodged: number;
  blocked: number;
  crits: number;
  damageDealt: number;
  skillsUsed: number;
}

export interface FighterState {
  side: Side;
  spec: CombatantSpec;
  x: number;
  facing: 1 | -1;
  hp: number;
  stamina: number;
  action: ActionKind;
  actionStart: number;
  actionDuration: number;
  attack: PendingAttack | null;
  reaction: PendingReaction | null;
  nextAttackAt: number;
  cooldowns: Partial<Record<SkillId, number>>;
  fortifyUntil: number;
  fortifyMul: number;
  passiveTime: number;
  counterQueued: boolean;
  counters: FighterCounters;
}

export type ImpactOutcome = 'hit' | 'miss' | 'dodge' | 'block';

export type CombatEvent =
  | { type: 'start'; t: number }
  | { type: 'action'; t: number; side: Side; action: ActionKind; duration: number }
  | { type: 'attack'; t: number; side: Side; kind: AttackKind; windup: number }
  | {
      type: 'impact';
      t: number;
      side: Side;
      target: Side;
      kind: AttackKind;
      outcome: ImpactOutcome;
      damage: number;
      crit: boolean;
      stagger: boolean;
    }
  | { type: 'skill'; t: number; side: Side; skill: SkillId }
  | { type: 'buffEnd'; t: number; side: Side }
  | { type: 'exhausted'; t: number; side: Side }
  | { type: 'end'; t: number; winner: Side; reason: 'ko' | 'decision' | 'forfeit' };

export interface FighterSummary {
  name: string;
  hp: number;
  maxHp: number;
  counters: FighterCounters;
}

export interface CombatResult {
  winner: Side;
  reason: 'ko' | 'decision' | 'forfeit';
  /** duração da luta (sem a apresentação), em segundos */
  duration: number;
  fighters: [FighterSummary, FighterSummary];
}

export interface CombatOptions {
  seed: number;
  /** limite de tempo da luta em segundos (após a apresentação) */
  timeLimit?: number;
  /** duração da apresentação (entrada na arena) */
  introDuration?: number;
}
