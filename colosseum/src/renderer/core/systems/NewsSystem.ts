// Cápua Times: o jornal diário da cidade. As notícias sobre o gladiador são
// geradas pelos acontecimentos (fama, vitórias, sequências...) e publicadas
// na edição da manhã seguinte. Cada notícia guarda o modelo de texto e as
// variáveis, então é exibida no idioma escolhido (e pode ter ilustração).
import type { FightMode, NewsItem, PlayerState } from '../model/types';
import { getPoolFighter } from '../data/fighters';
import { isFestival, isMerchantDay } from './EventSystem';
import { weekdayIndex } from '../data/locations';
import { OPPONENTS, getOpponent, type OpponentDef } from '../data/opponents';
import { ARENAS, arenaForOpponent } from '../data/arenas';
import { getOrigin } from '../data/gladiators';
import { pick, type Rng } from './rng';
import { t, tk } from '../../i18n';
import { arenaName, originName } from '../../i18n/data';

export const FAME_MILESTONES = [10, 25, 50, 80, 120, 180, 250, 350, 450, 600];
const MAX_EDITIONS = 30;

/** Quantidade de variantes de cada modelo (textos em i18n: news.<grupo>.<n>.h/.b). */
export const NEWS_TPL = {
  debut: 2,
  fame: 5,
  victory: 3,
  champion: 1,
  arena: 1,
  streak3: 1,
  streak5: 1,
  streak10: 1,
  comeback: 1,
  lossKo: 2,
  lossDecision: 1,
  lossForfeit: 1,
  slump: 1,
  level: 2,
  rival: 3,
  city: 8,
  tavern: 2,
  rematchAsk: 2,
  rematchWin: 1,
  rematchLose: 1,
  rematchFled: 1,
  festivalSoon: 1,
  festival: 2,
  merchant: 2,
  armWin: 2,
  tourneySoon: 1,
  tourneyWin: 2,
  tourneyFinal: 1,
  tourneyOut: 1,
  tourneyNoShow: 1,
} as const;
export type NewsGroup = keyof typeof NEWS_TPL;

/** Ilustrações em preto e branco por tipo de notícia. */
const IMAGES: Partial<Record<NewsGroup, string[]>> = {
  debut: ['newcomer'],
  fame: ['crowd', 'statue'],
  victory: ['victory'],
  champion: ['colosseum'],
  arena: ['colosseum'],
  streak3: ['crowd'],
  streak5: ['victory'],
  streak10: ['statue'],
  comeback: ['victory'],
  lossKo: ['defeat'],
  lossDecision: ['defeat'],
  lossForfeit: ['defeat'],
  slump: ['training'],
  level: ['training'],
  rival: ['rival'],
  tavern: ['tavern'],
  rematchAsk: ['rival'],
  rematchWin: ['victory'],
  rematchLose: ['defeat'],
  rematchFled: ['rival'],
  festivalSoon: ['festival'],
  festival: ['festival'],
  merchant: ['merchant'],
  armWin: ['armwrestle'],
  tourneySoon: ['tournament'],
  tourneyWin: ['tournament'],
  tourneyFinal: ['tournament'],
  tourneyOut: ['tournament'],
  tourneyNoShow: ['tournament'],
};
const CITY_IMAGES = ['market', 'forum', 'ship', 'baths', 'theater', 'rain', 'temple', 'market'];

export type Vars = Record<string, string | number>;

/** Próximo adversário ainda não derrotado (o "rival" das manchetes). */
export function nextRival(p: PlayerState): OpponentDef {
  return OPPONENTS.find((o) => !p.defeatedOpponents.includes(o.id)) ?? OPPONENTS[OPPONENTS.length - 1];
}

function baseVars(p: PlayerState, extra: Vars = {}): Vars {
  const rival = nextRival(p);
  return { name: p.name, origin: p.origin, rival: rival.id, arena: arenaForOpponent(rival.id).id, ...extra };
}

/** Troca os ids das variáveis pelos nomes no idioma atual. */
function resolve(v: Vars = {}): Vars {
  const opp = (id: unknown) => getOpponent(String(id))?.name ?? getPoolFighter(String(id))?.name ?? String(id ?? '');
  const arena = ARENAS.find((a) => a.id === v.arena);
  return {
    ...v,
    city: t('news.city'),
    origin: originName(getOrigin(String(v.origin ?? ''))).toLowerCase(),
    rival: opp(v.rival),
    opp: opp(v.opp),
    arena: arena ? arenaName(arena) : String(v.arena ?? ''),
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function newsHeadline(n: NewsItem): string {
  return n.tpl ? cap(tk(`news.${n.tpl}.h`, resolve(n.v), n.headline)) : n.headline;
}

export function newsBody(n: NewsItem): string {
  return n.tpl ? cap(tk(`news.${n.tpl}.b`, resolve(n.v), n.body)) : n.body;
}

/** Tipos dos quais só a notícia mais recente interessa (evita manchetes repetidas na mesma edição). */
const SINGLE: ReadonlyArray<NewsItem['kind']> = ['streak', 'defeat'];

function add(p: PlayerState, kind: NewsItem['kind'], group: NewsGroup, rng: Rng, extra: Vars = {}): NewsItem {
  const idx = Math.floor(rng() * NEWS_TPL[group]);
  const tpl = `${group}.${idx}`;
  const v = baseVars(p, extra);
  if (SINGLE.includes(kind)) p.news.pending = p.news.pending.filter((n) => n.kind !== kind);
  const item: NewsItem = { id: `n${p.day}-${p.news.pending.length}-${Math.floor(rng() * 1e6)}`, kind, tpl, v, headline: '', body: '' };
  item.headline = newsHeadline(item);
  item.body = newsBody(item);
  p.news.pending.push(item);
  return item;
}

function illustrate(item: NewsItem | undefined, rng: Rng, chance: number): void {
  if (!item?.tpl || rng() >= chance) return;
  const [group, idx] = item.tpl.split('.');
  const pool = group === 'city' ? [CITY_IMAGES[Number(idx) % CITY_IMAGES.length]] : IMAGES[group as NewsGroup];
  if (pool?.length) item.img = pick(rng, pool);
}

/** Notícia de estreia (edição do primeiro dia), sempre com ilustração. */
export function debutEdition(p: PlayerState, rng: Rng): void {
  illustrate(add(p, 'debut', 'debut', rng), rng, 1);
  add(p, 'city', 'city', rng);
  p.news.editions.unshift({ day: p.day, items: p.news.pending.splice(0), read: false });
}

export function checkFame(p: PlayerState, rng: Rng): void {
  for (const m of FAME_MILESTONES) {
    const key = `fame${m}`;
    if (p.reputation >= m && !p.news.milestones.includes(key)) {
      p.news.milestones.push(key);
      add(p, 'fame', 'fame', rng);
      if (rng() < 0.5) add(p, 'rival', 'rival', rng);
    }
  }
}

export function onLevel(p: PlayerState, rng: Rng): void {
  for (const lv of [5, 10, 15, 20, 25, 30]) {
    const key = `level${lv}`;
    if (p.level >= lv && !p.news.milestones.includes(key)) {
      p.news.milestones.push(key);
      add(p, 'level', 'level', rng);
    }
  }
}

/** Boato da taverna que vira nota no jornal (a conversa com o rival). */
export function onTavernTalk(p: PlayerState, rng: Rng): void {
  if (rng() < 0.6) add(p, 'rival', 'tavern', rng);
}

export function onBattle(
  p: PlayerState,
  opp: OpponentDef,
  won: boolean,
  firstVictory: boolean,
  rng: Rng,
  reason: 'ko' | 'decision' | 'forfeit' = 'ko',
  prevStreak = 0,
  mode: FightMode = 'ladder',
): void {
  const where = { opp: opp.id, arena: arenaForOpponent(opp.id).id };
  if (mode === 'rematch') add(p, 'rival', won ? 'rematchWin' : 'rematchLose', rng, where);
  if (won) {
    if (firstVictory) {
      if (opp.id === OPPONENTS[OPPONENTS.length - 1].id) add(p, 'champion', 'champion', rng);
      else {
        add(p, 'victory', 'victory', rng, where);
        const next = nextRival(p);
        if (arenaForOpponent(next.id).id !== arenaForOpponent(opp.id).id) add(p, 'arena', 'arena', rng);
      }
    }
    if (prevStreak <= -2) add(p, 'streak', 'comeback', rng, where);
    if (p.streak === 3) add(p, 'streak', 'streak3', rng);
    if (p.streak === 5) add(p, 'streak', 'streak5', rng);
    if (p.streak === 10) add(p, 'streak', 'streak10', rng);
  } else {
    p.news.pending = p.news.pending.filter((n) => n.kind !== 'streak');
    if (p.streak === -3) add(p, 'defeat', 'slump', rng, where);
    else if (mode !== 'rematch') add(p, 'defeat', reason === 'forfeit' ? 'lossForfeit' : reason === 'decision' ? 'lossDecision' : 'lossKo', rng, where);
  }
  checkFame(p, rng);
  onLevel(p, rng);
}

/** Um adversário derrotado pede revanche (manchete da manhã seguinte). */
export function onRematchAsked(p: PlayerState, opponentId: string, rng: Rng): void {
  illustrate(add(p, 'rival', 'rematchAsk', rng, { opp: opponentId }), rng, 0.6);
}

/** Notícias de eventos (queda de braço, torneio, revanche esquecida). */
export function onEvent(p: PlayerState, group: 'armWin' | 'tourneyWin' | 'tourneyFinal' | 'tourneyOut' | 'tourneyNoShow' | 'rematchFled', rng: Rng, extra: Vars = {}): void {
  const item = add(p, group.startsWith('tourney') ? 'tournament' : 'event', group, rng, extra);
  if (group === 'tourneyWin' || group === 'armWin') illustrate(item, rng, 0.8);
}

/** Avisos da cidade na edição da manhã: festival, mercador e torneio de sábado. */
function cityEvents(p: PlayerState, rng: Rng): void {
  if (isFestival(p.day)) illustrate(add(p, 'event', 'festival', rng), rng, 0.8);
  else if (isFestival(p.day + 1)) add(p, 'event', 'festivalSoon', rng);
  if (isMerchantDay(p.createdAt, p.day)) illustrate(add(p, 'event', 'merchant', rng), rng, 0.5);
  if (weekdayIndex(p.day) === 5) add(p, 'event', 'tourneySoon', rng);
}

/** Publica a edição do dia (ao acordar). Retorna a edição se houver notícias do gladiador. */
export function publish(p: PlayerState, rng: Rng) {
  const own = p.news.pending.splice(0, 5);
  p.news.pending = [];
  cityEvents(p, rng);
  own.push(...p.news.pending.splice(0));
  const items = [...own];
  add(p, 'city', 'city', rng);
  items.push(...p.news.pending.splice(0));
  // de vez em quando, uma ilustração em preto e branco na manchete principal ou numa nota da cidade
  illustrate(items[0], rng, 0.7);
  if (!items[0]?.img) illustrate(items[items.length - 1], rng, 0.4);
  const edition = { day: p.day, items, read: false };
  p.news.editions.unshift(edition);
  if (p.news.editions.length > MAX_EDITIONS) p.news.editions.length = MAX_EDITIONS;
  return own.length ? edition : null;
}

export function unreadCount(p: PlayerState): number {
  return p.news.editions.filter((e) => !e.read).length;
}
