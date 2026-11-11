import type { Appearance, CareerState, PlayerState } from '../model/types';
import { ATTRIBUTE_KEYS } from '../model/types';
import { BASE_ATTRIBUTE, emptyAttributes, getOrigin } from '../data/gladiators';
import { OPPONENTS } from '../data/opponents';
import { skillPointsForLevel } from './SkillTreeSystem';
import { debutEdition } from './NewsSystem';
import { createRng } from './rng';
import { t } from '../../i18n';

export const SAVE_VERSION = 5;
export const STARTING_COINS = 150;
export const MAX_NAME_LENGTH = 20;

export function sanitizeName(raw: string): string {
  return raw.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

export function validateName(raw: string): string | null {
  const n = sanitizeName(raw);
  if (n.length < 2) return t('err.nameShort');
  if (!/^[\p{L}\p{N} '.-]+$/u.test(n)) return t('err.nameChars');
  return null;
}

export function createPlayer(name: string, originId: string, appearance: Appearance, now = Date.now()): PlayerState {
  const p = buildPlayer(name, originId, appearance, now);
  debutEdition(p, createRng(now));
  return p;
}

function buildPlayer(name: string, originId: string, appearance: Appearance, now: number): PlayerState {
  const origin = getOrigin(originId);
  const base = emptyAttributes(BASE_ATTRIBUTE);
  for (const k of ATTRIBUTE_KEYS) base[k] += origin.bonus[k] ?? 0;
  return {
    version: SAVE_VERSION,
    name: sanitizeName(name),
    origin: origin.id,
    appearance: { ...appearance },
    level: 1,
    xp: 0,
    coins: STARTING_COINS,
    reputation: 0,
    baseAttributes: base,
    trainedBonus: emptyAttributes(),
    unspentPoints: 0,
    training: {
      str: { progress: 0, sessions: 0 },
      res: { progress: 0, sessions: 0 },
      agi: { progress: 0, sessions: 0 },
      tech: { progress: 0, sessions: 0 },
    },
    equipment: { mainHand: 'i1', offHand: null, head: null, body: null, legs: null },
    inventory: [{ uid: 'i1', itemId: 'rudis' }],
    history: [],
    stats: { wins: 0, losses: 0, battles: 0 },
    strategy: 'balanced',
    defeatedOpponents: [],
    selectedOpponent: OPPONENTS[0].id,
    settings: { battleSpeed: 1, autoContinue: false, tipsSeen: [], volume: 0.7, muted: false, language: 'pt' },
    nextUid: 2,
    day: 1,
    minutes: 8 * 60,
    energy: 100,
    location: 'home',
    skillPoints: skillPointsForLevel(1),
    perks: [],
    respecs: 0,
    streak: 0,
    news: { editions: [], pending: [], milestones: [] },
    upgrades: [],
    tavern: { rumorDay: 0, heard: [] },
    rivals: {},
    rematch: null,
    lastRematchDay: 0,
    injury: null,
    tournament: { registered: 0, run: null, titles: 0, best: -1 },
    events: { armDay: 0, armWins: 0, merchantDay: 0, merchantBought: [], freeDay: 0, freeCount: 0 },
    career: emptyCareer(),
    createdAt: now,
    updatedAt: now,
  };
}

/** Estado inicial da carreira (versão 5). */
export function emptyCareer(): CareerState {
  return {
    invites: [],
    respect: {},
    partner: null,
    quest: null,
    questsDone: 0,
    questDay: 0,
    rank: [],
    rankDay: 0,
    rankPts: 0,
    rankPrev: 0,
    talkDay: 0,
    chatDays: {},
    beastDay: 0,
    beastWins: 0,
    duoWins: 0,
    duoDay: 0,
    thumbsUp: 0,
  };
}
