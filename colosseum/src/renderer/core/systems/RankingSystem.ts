// Ranking da cidade (tabela no fórum): os gladiadores conhecidos (adversários da
// escada e lutadores avulsos) lutam entre si todas as noites; o jogador ganha pontos
// com as próprias lutas. Vitória vale 3 pontos, derrota 1 (quem luta aparece).
import type { PlayerState, RankEntry } from '../model/types';
import { OPPONENTS, getOpponent } from '../data/opponents';
import { POOL, daySeed, getPoolFighter, poolOpponent, shuffle } from '../data/fighters';
import { opponentCombatant } from '../combat/CombatantFactory';
import { CombatEngine } from '../combat/CombatEngine';
import { createRng } from './rng';

export const RANK_WIN = 3;
export const RANK_LOSS = 1;
/** quantos gladiadores a tabela acompanha (além do jogador) */
export const RANK_FIELD = 14;

export interface RankRow {
  id: string;
  level: number;
  pts: number;
  w: number;
  l: number;
  pos: number;
  /** posição de ontem (0 = estreia na tabela) */
  prev: number;
  player: boolean;
}

/** Monta a tabela inicial: 6 adversários da escada + 8 lutadores avulsos, com pontos de carreira. */
export function seedRanking(p: PlayerState): RankEntry[] {
  const rng = createRng(daySeed(p.createdAt, 1, 120));
  const ladder = OPPONENTS.slice(0, 6).map((o) => ({ id: o.id, level: o.level }));
  const pool = shuffle(rng, POOL)
    .slice(0, RANK_FIELD - ladder.length)
    .map((f) => ({ id: f.id, level: Math.max(1, Math.round(2 + rng() * 10)) }));
  return [...ladder, ...pool].map((e) => {
    const w = Math.round(e.level * (1.5 + rng() * 1.5));
    const l = Math.round(e.level * (0.5 + rng()));
    return { id: e.id, level: e.level, pts: w * RANK_WIN + l * RANK_LOSS, w, l, prev: 0 };
  });
}

function defOf(e: RankEntry) {
  const o = getOpponent(e.id);
  if (o) return o;
  const f = getPoolFighter(e.id);
  return f ? poolOpponent(f, e.level) : null;
}

/** Garante a tabela criada (saves antigos começam com ela vazia). */
export function ensureRanking(p: PlayerState): void {
  if (!p.career.rank.length) {
    p.career.rank = seedRanking(p);
    p.career.rankDay = p.day;
  }
}

/** Ordena a tabela com o jogador incluído. */
export function rankTable(p: PlayerState): RankRow[] {
  ensureRanking(p);
  const rows: RankRow[] = [
    ...p.career.rank.map((e) => ({ ...e, pos: 0, player: false })),
    { id: 'player', level: p.level, pts: p.career.rankPts, w: p.stats.wins, l: p.stats.losses, pos: 0, prev: p.career.rankPrev, player: true },
  ];
  rows.sort((a, b) => b.pts - a.pts || b.w - a.w || (a.player ? -1 : b.player ? 1 : 0));
  rows.forEach((r, i) => (r.pos = i + 1));
  return rows;
}

export function playerPosition(p: PlayerState): number {
  return rankTable(p).find((r) => r.player)?.pos ?? 0;
}

/** Pontos das lutas do jogador. */
export function rankFight(p: PlayerState, won: boolean): void {
  p.career.rankPts += won ? RANK_WIN : RANK_LOSS;
}

/**
 * Noite na cidade: guarda as posições de ontem e os outros gladiadores lutam entre
 * si (resultado estável por dia). Os mais fortes tendem a vencer, mas há surpresas.
 * Retorna a luta mais marcante (para o jornal).
 */
export function nightlyRanking(p: PlayerState): { winner: string; loser: string } | null {
  ensureRanking(p);
  if (p.career.rankDay >= p.day) return null;
  p.career.rankDay = p.day;
  const before = rankTable(p);
  for (const e of p.career.rank) e.prev = before.find((r) => r.id === e.id)?.pos ?? 0;
  p.career.rankPrev = before.find((r) => r.player)?.pos ?? 0;
  const rng = createRng(daySeed(p.createdAt, p.day, 121));
  const order = shuffle(rng, p.career.rank.map((_, i) => i));
  let best: { winner: string; loser: string; gap: number } | null = null;
  // metade da tabela luta a cada noite
  for (let k = 0; k + 1 < order.length && k < 8; k += 2) {
    const a = p.career.rank[order[k]];
    const b = p.career.rank[order[k + 1]];
    const da = defOf(a);
    const db = defOf(b);
    if (!da || !db) continue;
    const res = new CombatEngine(opponentCombatant(da).spec, opponentCombatant(db).spec, { seed: Math.floor(rng() * 1e9) }).runToEnd();
    const [win, lose] = res.winner === 0 ? [a, b] : [b, a];
    win.w++;
    win.pts += RANK_WIN;
    lose.l++;
    lose.pts += RANK_LOSS;
    // de vez em quando alguém treina e sobe de nível
    if (rng() < 0.25) win.level = Math.min(30, win.level + 1);
    const gap = lose.level - win.level;
    if (!best || gap > best.gap) best = { winner: win.id, loser: lose.id, gap };
  }
  return best ? { winner: best.winner, loser: best.loser } : null;
}
