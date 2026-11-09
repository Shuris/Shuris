import type { Appearance, PlayerState } from '../model/types';
import { ATTRIBUTE_KEYS } from '../model/types';
import { BASE_ATTRIBUTE, emptyAttributes, getOrigin } from '../data/gladiators';
import { OPPONENTS } from '../data/opponents';

export const SAVE_VERSION = 1;
export const STARTING_COINS = 150;
export const MAX_NAME_LENGTH = 20;

export function sanitizeName(raw: string): string {
  return raw.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

export function validateName(raw: string): string | null {
  const n = sanitizeName(raw);
  if (n.length < 2) return 'O nome deve ter pelo menos 2 caracteres.';
  if (!/^[\p{L}\p{N} '.-]+$/u.test(n)) return 'Use apenas letras, números, espaços, apóstrofo, ponto ou hífen.';
  return null;
}

export function createPlayer(name: string, originId: string, appearance: Appearance, now = Date.now()): PlayerState {
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
    settings: { battleSpeed: 1, autoContinue: false, tipsSeen: [] },
    nextUid: 2,
    createdAt: now,
    updatedAt: now,
  };
}
