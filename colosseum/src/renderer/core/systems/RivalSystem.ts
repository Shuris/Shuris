// Rivais que lembram do jogador e ferimentos.
// - Cada adversário da escada guarda vitórias e derrotas contra o jogador.
// - Um adversário já derrotado só luta de novo se PEDIR revanche. O pedido é
//   raro (no máximo um a cada 7 dias) e, enquanto espera, ele treina.
// - Derrota por nocaute ou desistência deixa o gladiador ferido por 1 ou 2 dias.
import type { PlayerState } from '../model/types';
import { getOpponent, rematchBoost, withLevel, type OpponentDef } from '../data/opponents';
import { getLocation, isOpen } from '../data/locations';
import { advance, DAY_END, type Check } from './CalendarSystem';
import { isUnlocked } from './ProgressionSystem';
import type { Rng } from './rng';
import { t } from '../../i18n';

export const REMATCH_CHANCE = 0.35;
export const REMATCH_COOLDOWN = 7;
export const REMATCH_WINDOW = 7;
export const REMATCH_REWARD_MUL = 1.5;

export function recordRival(p: PlayerState, opponentId: string, won: boolean): void {
  if (!getOpponent(opponentId)) return;
  const m = p.rivals[opponentId] ?? { wins: 0, losses: 0, lastDay: 0, last: 'win' as const };
  if (won) m.wins++;
  else m.losses++;
  m.lastDay = p.day;
  m.last = won ? 'win' : 'loss';
  p.rivals[opponentId] = m;
}

export function rematchActive(p: PlayerState, opponentId: string): boolean {
  return !!p.rematch && p.rematch.opponentId === opponentId && p.day >= p.rematch.askedDay && p.day <= p.rematch.expires;
}

/**
 * Depois de perder para o jogador, o adversário pode pedir revanche (sai no jornal
 * da manhã seguinte). Retorna true se pediu.
 */
export function maybeAskRematch(p: PlayerState, opponentId: string, rng: Rng): boolean {
  if (p.rematch || !getOpponent(opponentId)) return false;
  if (p.lastRematchDay && p.day - p.lastRematchDay < REMATCH_COOLDOWN) return false;
  if (rng() >= REMATCH_CHANCE) return false;
  p.rematch = { opponentId, askedDay: p.day + 1, expires: p.day + REMATCH_WINDOW };
  p.lastRematchDay = p.day;
  return true;
}

/** Pedido expirado sem resposta (chamado ao dormir). Retorna o id de quem esperou em vão. */
export function expireRematch(p: PlayerState): string | null {
  if (!p.rematch || p.day <= p.rematch.expires) return null;
  const id = p.rematch.opponentId;
  p.rematch = null;
  p.reputation = Math.max(0, p.reputation - 2);
  return id;
}

/** Ficha do adversário para a luta (na revanche ele vem mais forte). */
export function fightDef(p: PlayerState, def: OpponentDef): OpponentDef {
  if (!rematchActive(p, def.id) || !p.rematch) return def;
  return withLevel(def, Math.min(30, def.level + rematchBoost(p.rematch.askedDay, p.day)));
}

/** Pode lutar contra este adversário da escada agora? */
export function ladderCheck(p: PlayerState, opponentId: string): Check {
  if (!isUnlocked(p, opponentId)) return t('arena.unavailable');
  if (p.defeatedOpponents.includes(opponentId) && !rematchActive(p, opponentId)) return t('rival.alreadyBeaten');
  return null;
}

/** Que tipo de fala o adversário usa ao entrar na arena. */
export function introMoment(p: PlayerState, opponentId: string): 'intro' | 'rematch' | 'gloat' {
  if (rematchActive(p, opponentId)) return 'rematch';
  if (p.rivals[opponentId]?.last === 'loss') return 'gloat';
  return 'intro';
}

// ------------------------------------------------------------------ ferimentos
export const MEDIC_MINUTES = 30;

/** Derrota por nocaute (1 ou 2 dias) ou desistência (1 dia) deixa ferido. */
export function applyInjury(p: PlayerState, reason: 'ko' | 'decision' | 'forfeit', rng: Rng): number {
  if (reason === 'decision') return 0;
  const days = reason === 'ko' ? (rng() < 0.5 ? 1 : 2) : 1;
  p.injury = { days: Math.min(3, Math.max(p.injury?.days ?? 0, days)) };
  return p.injury.days;
}

export function medicCost(p: PlayerState): number {
  return 20 + p.level * 4;
}

export function canSeeMedic(p: PlayerState): Check {
  if (!p.injury) return t('injury.none');
  if (!isOpen(getLocation('ludus'), p.minutes, p.day)) return t('cal.ludusClosed');
  if (p.coins < medicCost(p)) return t('err.noCoins');
  if (p.minutes + MEDIC_MINUTES > DAY_END) return t('cal.tooLate');
  return null;
}

/** O médico do ludus cuida do ferimento de uma vez. */
export function seeMedic(p: PlayerState): Check {
  const err = canSeeMedic(p);
  if (err) return err;
  p.coins -= medicCost(p);
  p.injury = null;
  advance(p, MEDIC_MINUTES);
  return null;
}
