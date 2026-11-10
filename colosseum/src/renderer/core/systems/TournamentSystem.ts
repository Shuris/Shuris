// Torneio de sábado: inscrição antecipada (domingo a sexta, na arena), chave com
// 8 lutadores (o jogador e 7 competidores novos) e três rodadas seguidas a partir
// das 14h. As lutas entre os outros competidores são simuladas pelo próprio motor.
import type { PlayerState, TournamentRun } from '../model/types';
import { CombatEngine } from '../combat/CombatEngine';
import { opponentCombatant } from '../combat/CombatantFactory';
import { POOL, daySeed, getPoolFighter, poolOpponent, shuffle } from '../data/fighters';
import type { OpponentDef } from '../data/opponents';
import { getLocation, isOpen, weekdayIndex } from '../data/locations';
import { addItem } from './EquipmentSystem';
import { grantXp, rollDrop } from './ProgressionSystem';
import { advance, DAY_END, spendEnergy, type Check } from './CalendarSystem';
import { createRng, type Rng } from './rng';
import { t } from '../../i18n';

export const TOURNAMENT_START = 14 * 60;
/** depois disso, quem não apareceu perde a inscrição */
export const TOURNAMENT_LATE = 16 * 60;
export const TOURNAMENT_ENERGY = 15;
export const TOURNAMENT_MIN_ENERGY = 45;
export const TOURNAMENT_FIGHT_MINUTES = 40;
export const ROUND_KEYS = ['tour.round0', 'tour.round1', 'tour.round2'] as const;

export function isSaturday(day: number): boolean {
  return weekdayIndex(day) === 6;
}

/** Próximo sábado (hoje, se for sábado). */
export function nextSaturday(day: number): number {
  let d = day;
  while (!isSaturday(d)) d++;
  return d;
}

export function entryFee(p: PlayerState): number {
  return 20 + p.level * 5;
}

/** Prêmios por rodada alcançada: 0 = caiu nas quartas, 1 = semifinal, 2 = vice, 3 = campeão. */
export function prize(level: number, reached: number): { coins: number; fame: number; xp: number } {
  return [
    { coins: 0, fame: 1, xp: 20 + level * 4 },
    { coins: 20 + level * 5, fame: 2, xp: 40 + level * 6 },
    { coins: 50 + level * 10, fame: 5, xp: 70 + level * 8 },
    { coins: 120 + level * 30, fame: 12, xp: 110 + level * 12 },
  ][Math.max(0, Math.min(3, reached))];
}

export function canRegister(p: PlayerState): Check {
  if (p.location !== 'arena') return t('tour.atArena');
  if (!isOpen(getLocation('arena'), p.minutes, p.day)) return t('cal.arenaClosed');
  const sat = nextSaturday(p.day);
  if (p.tournament.registered === sat) return t('tour.already');
  if (isSaturday(p.day)) return t('tour.lateRegister');
  if (p.coins < entryFee(p)) return t('err.noCoins');
  return null;
}

export function register(p: PlayerState): Check {
  const err = canRegister(p);
  if (err) return err;
  p.coins -= entryFee(p);
  p.tournament.registered = nextSaturday(p.day);
  return null;
}

/** Monta a chave do sábado: jogador + 7 competidores perto do seu nível. */
export function buildBracket(p: PlayerState): TournamentRun {
  const rng = createRng(daySeed(p.createdAt, p.day, 31));
  const rivals = shuffle(rng, POOL).slice(0, 7);
  const offsets = shuffle(rng, [-2, -1, -1, 0, 0, 1, 2]);
  const ids = ['player', ...rivals.map((f) => f.id)];
  const levels = [p.level, ...offsets.map((o) => Math.max(1, Math.min(30, p.level + o)))];
  const order = shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7]);
  return { day: p.day, bracket: order.map((i) => ids[i]), levels: order.map((i) => levels[i]), winners: [], done: false };
}

export function canStart(p: PlayerState): Check {
  if (!isSaturday(p.day)) return t('tour.saturdayOnly');
  if (p.tournament.registered !== p.day) return t('tour.notRegistered');
  if (p.tournament.run) return null;
  if (p.minutes < TOURNAMENT_START) return t('tour.startsAt');
  if (p.minutes >= TOURNAMENT_LATE) return t('tour.tooLate');
  if (p.energy < TOURNAMENT_MIN_ENERGY) return t('tour.needEnergy', { n: TOURNAMENT_MIN_ENERGY });
  return null;
}

export function startTournament(p: PlayerState): Check {
  const err = canStart(p);
  if (err) return err;
  if (!p.tournament.run) p.tournament.run = buildBracket(p);
  return null;
}

/** Rodada atual (0 = quartas, 1 = semifinal, 2 = final, 3 = acabou). */
export function currentRound(run: TournamentRun): number {
  const n = run.winners.length;
  return n < 4 ? 0 : n < 6 ? 1 : n < 7 ? 2 : 3;
}

/** Lutadores (índices da chave) de cada luta de uma rodada. */
export function roundPairs(run: TournamentRun, round: number): Array<[number, number]> {
  if (round === 0) return [[0, 1], [2, 3], [4, 5], [6, 7]];
  const prev = round === 1 ? run.winners.slice(0, 4) : run.winners.slice(4, 6);
  const out: Array<[number, number]> = [];
  for (let i = 0; i + 1 < prev.length; i += 2) out.push([prev[i], prev[i + 1]]);
  return out;
}

export const playerSlot = (run: TournamentRun) => run.bracket.indexOf('player');

export function opponentAt(run: TournamentRun, slot: number): OpponentDef | null {
  const f = getPoolFighter(run.bracket[slot]);
  return f ? poolOpponent(f, run.levels[slot]) : null;
}

/** Adversário do jogador na rodada atual (null se eliminado ou acabou). */
export function playerMatch(run: TournamentRun): { round: number; opponentSlot: number; opponent: OpponentDef } | null {
  if (run.done) return null;
  const round = currentRound(run);
  if (round > 2) return null;
  const me = playerSlot(run);
  const pair = roundPairs(run, round).find(([a, b]) => a === me || b === me);
  if (!pair) return null;
  const other = pair[0] === me ? pair[1] : pair[0];
  const opponent = opponentAt(run, other);
  return opponent ? { round, opponentSlot: other, opponent } : null;
}

/** Simula uma luta entre dois competidores (resultado estável para a mesma chave). */
function simulate(run: TournamentRun, a: number, b: number, rng: Rng): number {
  const da = opponentAt(run, a);
  const db = opponentAt(run, b);
  if (!da || !db) return da ? a : b;
  const res = new CombatEngine(opponentCombatant(da).spec, opponentCombatant(db).spec, { seed: Math.floor(rng() * 1e9) }).runToEnd();
  return res.winner === 0 ? a : b;
}

/** Registra o resultado da luta do jogador e simula as outras lutas da rodada. */
export function recordPlayerFight(p: PlayerState, won: boolean): void {
  const run = p.tournament.run;
  if (!run || run.done) return;
  const match = playerMatch(run);
  if (!match) return;
  const rng = createRng(daySeed(p.createdAt, p.day, 50 + run.winners.length));
  const me = playerSlot(run);
  for (const [a, b] of roundPairs(run, match.round)) {
    if (a === me || b === me) run.winners.push(won ? me : match.opponentSlot);
    else run.winners.push(simulate(run, a, b, rng));
  }
  spendEnergy(p, TOURNAMENT_ENERGY);
  advance(p, TOURNAMENT_FIGHT_MINUTES);
  if (!won) {
    // eliminado: as outras rodadas acontecem sem ele
    while (currentRound(run) <= 2) {
      for (const [a, b] of roundPairs(run, currentRound(run))) run.winners.push(simulate(run, a, b, rng));
    }
    run.done = true;
  } else if (currentRound(run) > 2) run.done = true;
}

/** Até onde o jogador chegou (0 = quartas ... 3 = campeão). */
export function reachedRound(run: TournamentRun): number {
  const me = playerSlot(run);
  if (run.winners[6] === me) return 3;
  if (run.winners.slice(4, 6).includes(me)) return 2;
  if (run.winners.slice(0, 4).includes(me)) return 1;
  return 0;
}

export interface TournamentPrize {
  reached: number;
  coins: number;
  fame: number;
  xp: number;
  itemId: string | null;
  champion: string;
  levelUps: number;
}

/** Entrega os prêmios e fecha o torneio. */
export function closeTournament(p: PlayerState, rng: Rng): TournamentPrize | null {
  const run = p.tournament.run;
  if (!run || !run.done) return null;
  const reached = reachedRound(run);
  const pr = prize(p.level, reached);
  p.coins += pr.coins;
  p.reputation += pr.fame;
  const levelUps = grantXp(p, pr.xp);
  let itemId: string | null = null;
  if (reached === 3) {
    p.tournament.titles++;
    itemId = rollDrop(5 + Math.min(3, Math.floor(p.level / 8)), rng);
    addItem(p, itemId);
  }
  p.tournament.best = Math.max(p.tournament.best, reached);
  const champSlot = run.winners[6];
  const champion = run.bracket[champSlot] ?? 'player';
  p.tournament.run = null;
  p.tournament.registered = 0;
  return { reached, ...pr, itemId, champion, levelUps };
}

/** Não apareceu no sábado: perde a inscrição. Retorna true se aconteceu agora. */
export function checkNoShow(p: PlayerState): boolean {
  const reg = p.tournament.registered;
  if (!reg || p.tournament.run) return false;
  const missed = p.day > reg || (p.day === reg && p.minutes >= TOURNAMENT_LATE);
  if (!missed) return false;
  p.tournament.registered = 0;
  return true;
}

/** Ainda dá tempo de lutar o restante do torneio hoje? */
export function timeForFight(p: PlayerState): boolean {
  return p.minutes + TOURNAMENT_FIGHT_MINUTES <= DAY_END;
}

/** Torneio largado no meio (dormiu ou fechou o jogo): o jogador perde a luta atual. */
export function abandonTournament(p: PlayerState): void {
  const run = p.tournament.run;
  if (!run || run.done) return;
  const energy = p.energy;
  const minutes = p.minutes;
  recordPlayerFight(p, false);
  p.energy = energy;
  p.minutes = minutes;
}
