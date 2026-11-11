// Serialização e validação dos dados salvos. Dados corrompidos ou adulterados
// são rejeitados ou corrigidos (valores fora da faixa são limitados).
import type { Attributes, BattleRecord, Edition, LocationId, NewsItem, PlayerState, Slot, StrategyId, TrainingId } from '../model/types';
import { getPerk } from '../data/skillTree';
import { getUpgrade } from '../data/upgrades';
import { LOCATIONS } from '../data/locations';
import { skillPointsForLevel } from './SkillTreeSystem';
import { ATTRIBUTE_KEYS, SLOTS } from '../model/types';
import { MAX_ATTRIBUTE, MAX_LEVEL, ORIGINS } from '../data/gladiators';
import { getItem, MAX_PLUS } from '../data/equipment';
import { getPoolFighter } from '../data/fighters';
import type { CareerState, EventsState, RivalMemory, TournamentRun, TournamentState } from '../model/types';
import { OPPONENTS, getOpponent } from '../data/opponents';
import { HISTORY_LIMIT } from './ProgressionSystem';
import { SAVE_VERSION, emptyCareer, sanitizeName } from './PlayerFactory';
import { clamp } from './rng';
import { t } from '../../i18n';

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
  if (!text) return { ok: false, error: t('save.none') };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: t('save.corrupt') };
  }
  if (!isObj(raw) || raw.format !== SAVE_FORMAT || !isObj(raw.player)) {
    return { ok: false, error: t('save.unknown') };
  }
  if (typeof raw.version !== 'number' || raw.version > SAVE_VERSION) {
    return { ok: false, error: t('save.newer') };
  }
  return validatePlayer(raw.player);
}

export function validatePlayer(p: Obj): ParseResult {
  const w: string[] = [];
  const name = typeof p.name === 'string' ? sanitizeName(p.name) : '';
  if (name.length < 2) return { ok: false, error: t('save.badName') };

  const inventory: PlayerState['inventory'] = [];
  const seen = new Set<string>();
  if (Array.isArray(p.inventory)) {
    for (const it of p.inventory) {
      if (isObj(it) && typeof it.uid === 'string' && typeof it.itemId === 'string' && getItem(it.itemId) && !seen.has(it.uid)) {
        seen.add(it.uid);
        const plus = typeof it.plus === 'number' && Number.isFinite(it.plus) ? Math.round(clamp(it.plus, 0, MAX_PLUS)) : 0;
        inventory.push(plus ? { uid: it.uid, itemId: it.itemId, plus } : { uid: it.uid, itemId: it.itemId });
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
        reputation: int(h.reputation, 0, -1e6, 1e6, w, 'history.reputation'),
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
      skin: int(appearance.skin, 0, 0, 4, w, 'appearance.skin'),
      hairStyle: int(appearance.hairStyle, 0, 0, 6, w, 'appearance.hairStyle'),
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
      volume: typeof settings.volume === 'number' && Number.isFinite(settings.volume) ? clamp(settings.volume, 0, 1) : 0.7,
      muted: settings.muted === true,
      language: settings.language === 'en' ? 'en' : 'pt',
    },
    nextUid: Math.max(int(p.nextUid, maxUid + 1, 1, 1e9, w, 'nextUid'), maxUid + 1),
    ...calendarAndTree(p, w),
    // versão 3: melhorias e taverna
    upgrades: Array.isArray(p.upgrades) ? [...new Set(p.upgrades.filter((id): id is string => typeof id === 'string' && !!getUpgrade(id)))] : [],
    tavern: {
      rumorDay: int(isObj(p.tavern) ? p.tavern.rumorDay : 0, 0, 0, 1e7, w, 'tavern.rumorDay'),
      heard: isObj(p.tavern) && Array.isArray(p.tavern.heard) ? p.tavern.heard.filter((h): h is string => typeof h === 'string').slice(0, 200) : [],
    },
    ...v4Fields(p, w),
    createdAt: int(p.createdAt, Date.now(), 0, 8.64e15, w, 'createdAt'),
    updatedAt: int(p.updatedAt, Date.now(), 0, 8.64e15, w, 'updatedAt'),
  };
  if (!player.equipment.mainHand && inventory.length === 0) {
    player.inventory.push({ uid: `i${player.nextUid}`, itemId: 'rudis' });
    player.equipment.mainHand = `i${player.nextUid++}`;
  }
  return { ok: true, player, warnings: w };
}

const NEWS_KINDS = ['fame', 'victory', 'defeat', 'streak', 'level', 'arena', 'rival', 'champion', 'debut', 'city', 'event', 'tournament'];

function newsItems(v: unknown): NewsItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((n): n is Obj => isObj(n) && typeof n.headline === 'string' && typeof n.body === 'string')
    .slice(0, 12)
    .map((n, i) => ({
      id: typeof n.id === 'string' ? n.id.slice(0, 40) : `n${i}`,
      kind: (NEWS_KINDS.includes(n.kind as string) ? n.kind : 'city') as NewsItem['kind'],
      headline: (n.headline as string).slice(0, 140),
      body: (n.body as string).slice(0, 400),
      ...(typeof n.tpl === 'string' && /^[a-zA-Z0-9]+\.\d+$/.test(n.tpl) ? { tpl: n.tpl } : {}),
      ...(isObj(n.v) ? { v: newsVars(n.v) } : {}),
      ...(typeof n.img === 'string' && /^[a-z_]+$/.test(n.img) ? { img: n.img } : {}),
    }));
}

function newsVars(v: Obj): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, val] of Object.entries(v).slice(0, 12)) {
    if (!/^\w{1,20}$/.test(k)) continue;
    if (typeof val === 'string') out[k] = val.slice(0, 60);
    else if (typeof val === 'number' && Number.isFinite(val)) out[k] = val;
  }
  return out;
}

/** Campos da versão 2 (calendário, energia, árvore, jornal). Saves v1 recebem valores iniciais. */
function calendarAndTree(p: Obj, w: string[]) {
  const level = int(p.level, 1, 1, MAX_LEVEL, w, 'level');
  const v1 = p.skillPoints === undefined && p.perks === undefined;
  const perks = Array.isArray(p.perks) ? [...new Set(p.perks.filter((id): id is string => typeof id === 'string' && !!getPerk(id)))] : [];
  const spent = perks.reduce((s, id) => s + (getPerk(id)?.cost ?? 0), 0);
  const maxPoints = skillPointsForLevel(level);
  const news = isObj(p.news) ? p.news : {};
  const editions: Edition[] = Array.isArray(news.editions)
    ? news.editions
        .filter((e): e is Obj => isObj(e))
        .slice(0, 30)
        .map((e) => ({ day: int(e.day, 1, 1, 1e7, w, 'news.day'), items: newsItems(e.items), read: e.read === true }))
    : [];
  return {
    day: v1 ? 1 : int(p.day, 1, 1, 1e7, w, 'day'),
    minutes: v1 ? 8 * 60 : int(p.minutes, 8 * 60, 0, 26 * 60, w, 'minutes'),
    energy: v1 ? 100 : int(p.energy, 100, 0, 100, w, 'energy'),
    location: (LOCATIONS.some((l) => l.id === p.location) ? p.location : 'home') as LocationId,
    perks,
    skillPoints: v1 ? maxPoints : clamp(int(p.skillPoints, 0, 0, 100, w, 'skillPoints'), 0, Math.max(0, maxPoints - spent)),
    respecs: v1 ? 0 : int(p.respecs, 0, 0, 1000, w, 'respecs'),
    streak: v1 ? 0 : int(p.streak, 0, -1000, 1000, w, 'streak'),
    news: {
      editions,
      pending: isObj(p.news) ? newsItems(news.pending) : [],
      milestones: Array.isArray(news.milestones) ? news.milestones.filter((m): m is string => typeof m === 'string').slice(0, 100) : [],
    },
  };
}

/** Campos da versão 4 (rivais, revanche, ferimentos, torneio, eventos). Saves antigos recebem valores iniciais. */
function v4Fields(p: Obj, w: string[]) {
  const rivals: Record<string, RivalMemory> = {};
  if (isObj(p.rivals)) {
    for (const [id, m] of Object.entries(p.rivals)) {
      if (!getOpponent(id) || !isObj(m)) continue;
      rivals[id] = {
        wins: int(m.wins, 0, 0, 1e6, w, 'rivals.wins'),
        losses: int(m.losses, 0, 0, 1e6, w, 'rivals.losses'),
        lastDay: int(m.lastDay, 0, 0, 1e7, w, 'rivals.lastDay'),
        last: m.last === 'loss' ? 'loss' : 'win',
      };
    }
  }
  const rm = isObj(p.rematch) && typeof p.rematch.opponentId === 'string' && getOpponent(p.rematch.opponentId) ? p.rematch : null;
  const inj = isObj(p.injury) ? int(p.injury.days, 0, 0, 3, w, 'injury.days') : 0;
  const tr = isObj(p.tournament) ? p.tournament : {};
  const ev = isObj(p.events) ? p.events : {};
  const tournament: TournamentState = {
    registered: int(tr.registered, 0, 0, 1e7, w, 'tournament.registered'),
    run: tournamentRun(tr.run),
    titles: int(tr.titles, 0, 0, 1e5, w, 'tournament.titles'),
    best: int(tr.best, -1, -1, 3, w, 'tournament.best'),
  };
  const strList = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, max) : []);
  const events: EventsState = {
    armDay: int(ev.armDay, 0, 0, 1e7, w, 'events.armDay'),
    armWins: int(ev.armWins, 0, 0, 1e5, w, 'events.armWins'),
    merchantDay: int(ev.merchantDay, 0, 0, 1e7, w, 'events.merchantDay'),
    merchantBought: strList(ev.merchantBought, 10).filter((id) => !!getItem(id)),
    freeDay: int(ev.freeDay, 0, 0, 1e7, w, 'events.freeDay'),
    freeCount: int(ev.freeCount, 0, 0, 1000, w, 'events.freeCount'),
  };
  return {
    rivals,
    rematch: rm
      ? { opponentId: rm.opponentId as string, askedDay: int(rm.askedDay, 1, 1, 1e7, w, 'rematch.askedDay'), expires: int(rm.expires, 1, 1, 1e7, w, 'rematch.expires') }
      : null,
    lastRematchDay: int(p.lastRematchDay, 0, 0, 1e7, w, 'lastRematchDay'),
    injury: inj > 0 ? { days: inj } : null,
    tournament,
    events,
    career: careerFields(p.career, w),
  };
}

/** Campos da versão 5 (convites, amizades, missões, ranking, venatio). Saves antigos começam vazios. */
function careerFields(v: unknown, w: string[]): CareerState {
  const c = emptyCareer();
  if (!isObj(v)) return c;
  const n = (x: unknown, max: number, label: string, min = 0) => int(x, min, min, max, w, `career.${label}`);
  if (Array.isArray(v.invites)) {
    c.invites = v.invites
      .filter((i): i is Obj => isObj(i) && typeof i.id === 'string' && /^[a-z]{2,20}$/.test(i.id as string))
      .slice(0, 10)
      .map((i) => ({
        id: i.id as string,
        status: i.status === 'done' ? 'done' : 'open',
        day: n(i.day, 1e7, 'invite.day', 1),
        won: i.won === true,
        round: n(i.round, 3, 'invite.round'),
        foes: Array.isArray(i.foes)
          ? i.foes.filter((f): f is Obj => isObj(f) && typeof f.id === 'string' && !!getPoolFighter(f.id as string)).slice(0, 4).map((f) => ({ id: f.id as string, level: n(f.level, MAX_LEVEL, 'invite.level', 1) }))
          : [],
      }));
  }
  if (isObj(v.respect)) {
    for (const [id, r] of Object.entries(v.respect).slice(0, 100)) if (/^[a-z0-9_]{1,30}$/.test(id)) c.respect[id] = n(r, 100, 'respect');
  }
  c.partner = typeof v.partner === 'string' && c.respect[v.partner] !== undefined ? v.partner : null;
  if (isObj(v.quest) && typeof v.quest.id === 'string' && typeof v.quest.npc === 'string') {
    const q = v.quest;
    const kinds = ['beat', 'wins', 'deliver', 'offering', 'train'] as const;
    const kind = kinds.find((k) => k === q.kind);
    const rw = isObj(q.reward) ? q.reward : {};
    if (kind) {
      c.quest = {
        id: (q.id as string).slice(0, 30),
        npc: (q.npc as string).slice(0, 20),
        kind,
        target: typeof q.target === 'string' ? q.target.slice(0, 30) : '',
        need: n(q.need, 100, 'quest.need', 1),
        progress: n(q.progress, 100, 'quest.progress'),
        day: n(q.day, 1e7, 'quest.day', 1),
        expires: n(q.expires, 1e7, 'quest.expires', 1),
        reward: {
          coins: n(rw.coins, 1e6, 'quest.coins'),
          fame: n(rw.fame, 1000, 'quest.fame'),
          item: typeof rw.item === 'string' && getItem(rw.item) ? rw.item : null,
        },
      };
    }
  }
  c.questsDone = n(v.questsDone, 1e5, 'questsDone');
  c.questDay = n(v.questDay, 1e7, 'questDay');
  if (Array.isArray(v.rank)) {
    c.rank = v.rank
      .filter((r): r is Obj => isObj(r) && typeof r.id === 'string' && (!!getPoolFighter(r.id as string) || !!getOpponent(r.id as string)))
      .slice(0, 30)
      .map((r) => ({ id: r.id as string, level: n(r.level, MAX_LEVEL, 'rank.level', 1), pts: n(r.pts, 1e6, 'rank.pts'), w: n(r.w, 1e5, 'rank.w'), l: n(r.l, 1e5, 'rank.l'), prev: n(r.prev, 100, 'rank.prev') }));
  }
  c.rankDay = n(v.rankDay, 1e7, 'rankDay');
  c.rankPts = n(v.rankPts, 1e6, 'rankPts');
  c.rankPrev = n(v.rankPrev, 100, 'rankPrev');
  c.talkDay = n(v.talkDay, 1e7, 'talkDay');
  c.beastDay = n(v.beastDay, 1e7, 'beastDay');
  c.beastWins = n(v.beastWins, 1e5, 'beastWins');
  c.duoWins = n(v.duoWins, 1e5, 'duoWins');
  c.duoDay = n(v.duoDay, 1e7, 'duoDay');
  c.thumbsUp = n(v.thumbsUp, 1e5, 'thumbsUp');
  return c;
}

function tournamentRun(v: unknown): TournamentRun | null {
  if (!isObj(v) || !Array.isArray(v.bracket) || !Array.isArray(v.levels) || !Array.isArray(v.winners)) return null;
  const bracket = v.bracket.filter((id): id is string => typeof id === 'string');
  if (bracket.length !== 8 || bracket.filter((id) => id === 'player').length !== 1) return null;
  if (!bracket.every((id) => id === 'player' || getPoolFighter(id))) return null;
  const levels = v.levels.map((n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(clamp(n, 1, MAX_LEVEL)) : 1));
  const winners = v.winners.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 8).slice(0, 7);
  if (levels.length !== 8) return null;
  return { day: typeof v.day === 'number' ? Math.round(v.day) : 1, bracket, levels, winners, done: v.done === true };
}

function isStrategy(v: unknown): v is StrategyId {
  return v === 'aggressive' || v === 'balanced' || v === 'defensive';
}
