// Serialização e validação dos dados salvos. Dados corrompidos ou adulterados
// são rejeitados ou corrigidos (valores fora da faixa são limitados).
import type { Attributes, BattleRecord, PlayerState, Slot, StrategyId, TrainingId } from '../model/types';
import { ATTRIBUTE_KEYS, SLOTS } from '../model/types';
import { MAX_ATTRIBUTE, MAX_LEVEL, ORIGINS } from '../data/gladiators';
import { getItem } from '../data/equipment';
import { OPPONENTS, getOpponent } from '../data/opponents';
import { HISTORY_LIMIT } from './ProgressionSystem';
import { SAVE_VERSION, sanitizeName } from './PlayerFactory';
import { clamp } from './rng';

export const SAVE_FORMAT = 'colosseum-save';

export interface SaveEnvelope {
  format: typeof SAVE_FORMAT;
  version: number;
  savedAt: number;
  player: PlayerState;
}

export type ParseResult = { ok: true; player: PlayerState; warnings: string[] } | { ok: false; error: string };

export function serialize(player: PlayerState, now = Date.now()): string {
  const env: SaveEnvelope = { format: SAVE_FORMAT, version: SAVE_VERSION, savedAt: now, player };
  return JSON.stringify(env);
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, def: number, min: number, max: number, w: string[], field: string): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    w.push(`campo inválido: ${field}`);
    return def;
  }
  const c = clamp(v, min, max);
  if (c !== v) w.push(`valor ajustado: ${field}`);
  return c;
};
const int = (v: unknown, def: number, min: number, max: number, w: string[], field: string) =>
  Math.round(num(v, def, min, max, w, field));

function attrs(v: unknown, def: number, max: number, w: string[], field: string): Attributes {
  const o = isObj(v) ? v : {};
  if (!isObj(v)) w.push(`campo inválido: ${field}`);
  const a = {} as Attributes;
  for (const k of ATTRIBUTE_KEYS) a[k] = int(o[k], def, 0, max, w, `${field}.${k}`);
  return a;
}

export function parseSave(text: string | null | undefined): ParseResult {
  if (!text) return { ok: false, error: 'Nenhum dado salvo.' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Arquivo de salvamento corrompido (JSON inválido).' };
  }
  if (!isObj(raw) || raw.format !== SAVE_FORMAT || !isObj(raw.player)) {
    return { ok: false, error: 'Formato de salvamento desconhecido.' };
  }
  if (typeof raw.version !== 'number' || raw.version > SAVE_VERSION) {
    return { ok: false, error: 'Salvamento de uma versão mais nova do jogo.' };
  }
  return validatePlayer(raw.player);
}

export function validatePlayer(p: Obj): ParseResult {
  const w: string[] = [];
  const name = typeof p.name === 'string' ? sanitizeName(p.name) : '';
  if (name.length < 2) return { ok: false, error: 'Nome do gladiador ausente ou inválido.' };

  const inventory: PlayerState['inventory'] = [];
  const seen = new Set<string>();
  if (Array.isArray(p.inventory)) {
    for (const it of p.inventory) {
      if (isObj(it) && typeof it.uid === 'string' && typeof it.itemId === 'string' && getItem(it.itemId) && !seen.has(it.uid)) {
        seen.add(it.uid);
        inventory.push({ uid: it.uid, itemId: it.itemId });
      } else w.push('item de inventário inválido descartado');
    }
  }
  const equipment = { mainHand: null, offHand: null, head: null, body: null, legs: null } as Record<Slot, string | null>;
  const eq = isObj(p.equipment) ? p.equipment : {};
  for (const slot of SLOTS) {
    const uid = eq[slot];
    if (typeof uid === 'string') {
      const inv = inventory.find((i) => i.uid === uid);
      if (inv && getItem(inv.itemId)?.slot === slot) equipment[slot] = uid;
      else w.push(`equipamento inválido em ${slot}`);
    }
  }

  const appearance = isObj(p.appearance) ? p.appearance : {};
  const training = {} as PlayerState['training'];
  const tr = isObj(p.training) ? p.training : {};
  for (const id of ['str', 'res', 'agi', 'tech'] as TrainingId[]) {
    const t = isObj(tr[id]) ? (tr[id] as Obj) : {};
    training[id] = { progress: int(t.progress, 0, 0, 99, w, `training.${id}.progress`), sessions: int(t.sessions, 0, 0, 10000, w, `training.${id}.sessions`) };
  }

  const history: BattleRecord[] = [];
  if (Array.isArray(p.history)) {
    for (const h of p.history.slice(0, HISTORY_LIMIT)) {
      if (!isObj(h) || typeof h.opponentId !== 'string' || (h.result !== 'win' && h.result !== 'loss')) continue;
      history.push({
        id: typeof h.id === 'string' ? h.id : `b${history.length}`,
        date: int(h.date, 0, 0, 8.64e15, w, 'history.date'),
        opponentId: h.opponentId,
        opponentName: typeof h.opponentName === 'string' ? h.opponentName.slice(0, 60) : h.opponentId,
        opponentLevel: int(h.opponentLevel, 1, 1, MAX_LEVEL, w, 'history.opponentLevel'),
        playerLevel: int(h.playerLevel, 1, 1, MAX_LEVEL, w, 'history.playerLevel'),
        result: h.result,
        reason: h.reason === 'decision' || h.reason === 'forfeit' ? h.reason : 'ko',
        duration: int(h.duration, 0, 0, 100000, w, 'history.duration'),
        strategy: isStrategy(h.strategy) ? h.strategy : 'balanced',
        xp: int(h.xp, 0, 0, 1e7, w, 'history.xp'),
        coins: int(h.coins, 0, 0, 1e7, w, 'history.coins'),
        reputation: int(h.reputation, 0, 0, 1e6, w, 'history.reputation'),
        itemId: typeof h.itemId === 'string' && getItem(h.itemId) ? h.itemId : null,
        levelUps: int(h.levelUps, 0, 0, MAX_LEVEL, w, 'history.levelUps'),
      });
    }
  }

  const stats = isObj(p.stats) ? p.stats : {};
  const settings = isObj(p.settings) ? p.settings : {};
  const defeated = Array.isArray(p.defeatedOpponents)
    ? p.defeatedOpponents.filter((id): id is string => typeof id === 'string' && !!getOpponent(id))
    : [];
  const selected = typeof p.selectedOpponent === 'string' && getOpponent(p.selectedOpponent) ? p.selectedOpponent : OPPONENTS[0].id;
  const maxUid = inventory.reduce((m, i) => Math.max(m, parseInt(i.uid.replace(/\D/g, ''), 10) || 0), 0);

  const player: PlayerState = {
    version: SAVE_VERSION,
    name,
    origin: typeof p.origin === 'string' && ORIGINS.some((o) => o.id === p.origin) ? p.origin : ORIGINS[0].id,
    appearance: {
      skin: int(appearance.skin, 0, 0, 2, w, 'appearance.skin'),
      hairStyle: int(appearance.hairStyle, 0, 0, 2, w, 'appearance.hairStyle'),
      hairColor: int(appearance.hairColor, 0, 0, 5, w, 'appearance.hairColor'),
      beard: appearance.beard === true,
      clothColor: int(appearance.clothColor, 0, 0, 5, w, 'appearance.clothColor'),
    },
    level: int(p.level, 1, 1, MAX_LEVEL, w, 'level'),
    xp: int(p.xp, 0, 0, 1e8, w, 'xp'),
    coins: int(p.coins, 0, 0, 1e9, w, 'coins'),
    reputation: int(p.reputation, 0, 0, 1e7, w, 'reputation'),
    baseAttributes: attrs(p.baseAttributes, 5, MAX_ATTRIBUTE, w, 'baseAttributes'),
    trainedBonus: attrs(p.trainedBonus, 0, MAX_ATTRIBUTE, w, 'trainedBonus'),
    unspentPoints: int(p.unspentPoints, 0, 0, MAX_LEVEL * 3, w, 'unspentPoints'),
    training,
    equipment,
    inventory,
    history,
    stats: {
      wins: int(stats.wins, 0, 0, 1e9, w, 'stats.wins'),
      losses: int(stats.losses, 0, 0, 1e9, w, 'stats.losses'),
      battles: int(stats.battles, 0, 0, 1e9, w, 'stats.battles'),
    },
    strategy: isStrategy(p.strategy) ? p.strategy : 'balanced',
    defeatedOpponents: [...new Set(defeated)],
    selectedOpponent: selected,
    settings: {
      battleSpeed: [1, 2, 3].includes(settings.battleSpeed as number) ? (settings.battleSpeed as number) : 1,
      autoContinue: settings.autoContinue === true,
      tipsSeen: Array.isArray(settings.tipsSeen) ? settings.tipsSeen.filter((s): s is string => typeof s === 'string').slice(0, 50) : [],
    },
    nextUid: Math.max(int(p.nextUid, maxUid + 1, 1, 1e9, w, 'nextUid'), maxUid + 1),
    createdAt: int(p.createdAt, Date.now(), 0, 8.64e15, w, 'createdAt'),
    updatedAt: int(p.updatedAt, Date.now(), 0, 8.64e15, w, 'updatedAt'),
  };
  if (!player.equipment.mainHand && inventory.length === 0) {
    player.inventory.push({ uid: `i${player.nextUid}`, itemId: 'rudis' });
    player.equipment.mainHand = `i${player.nextUid++}`;
  }
  return { ok: true, player, warnings: w };
}

function isStrategy(v: unknown): v is StrategyId {
  return v === 'aggressive' || v === 'balanced' || v === 'defensive';
}
