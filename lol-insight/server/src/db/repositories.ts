import type { DatabaseSync } from 'node:sqlite';

import type { Rank, RankSnapshot, Region } from '../../../src/types/index.ts';
import type { StoredMatch } from '../services/normalize.ts';

export interface AccountRow {
  puuid: string;
  gameName: string;
  tagLine: string;
  region: Region;
  summonerLevel: number;
  profileIconId: number;
  firstSeenAt: number;
  updatedAt: number;
}

export interface MasteryRow {
  championId: number;
  level: number;
  points: number;
  lastPlayTime: number;
}

/** Todo o SQL do backend fica aqui. */
export class Repositories {
  constructor(private db: DatabaseSync) {}

  // ---- Contas ----------------------------------------------------------------

  upsertAccount(a: Omit<AccountRow, 'firstSeenAt' | 'updatedAt'>, now: number): void {
    this.db
      .prepare(
        `INSERT INTO accounts (puuid, game_name, tag_line, region, summoner_level, profile_icon_id, first_seen_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(puuid) DO UPDATE SET game_name = excluded.game_name, tag_line = excluded.tag_line, region = excluded.region,
           summoner_level = excluded.summoner_level, profile_icon_id = excluded.profile_icon_id, updated_at = excluded.updated_at`,
      )
      .run(a.puuid, a.gameName, a.tagLine, a.region, a.summonerLevel, a.profileIconId, now, now);
  }

  getAccount(puuid: string): AccountRow | null {
    const r = this.db.prepare('SELECT * FROM accounts WHERE puuid = ?').get(puuid) as Record<string, unknown> | undefined;
    return r ? toAccount(r) : null;
  }

  findAccountByRiotId(region: Region, gameName: string, tagLine: string): AccountRow | null {
    const r = this.db
      .prepare('SELECT * FROM accounts WHERE region = ? AND game_name = ? COLLATE NOCASE AND tag_line = ? COLLATE NOCASE')
      .get(region, gameName, tagLine) as Record<string, unknown> | undefined;
    return r ? toAccount(r) : null;
  }

  // ---- Partidas --------------------------------------------------------------

  /** Dos IDs informados, devolve os que ainda não estão armazenados. */
  missingMatchIds(ids: string[]): string[] {
    if (!ids.length) return [];
    const have = new Set(
      (this.db.prepare(`SELECT match_id FROM matches WHERE match_id IN (${ids.map(() => '?').join(',')})`).all(...ids) as Array<{ match_id: string }>).map(
        (r) => r.match_id,
      ),
    );
    return ids.filter((id) => !have.has(id));
  }

  saveMatch(match: StoredMatch, region: Region, now: number): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO matches (match_id, region, queue_id, game_creation, duration_sec, data, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(match.matchId, region, match.queueId, match.gameCreation, match.durationSec, JSON.stringify(match), now);
  }

  /** Registra as estatísticas individuais de uma conta em uma partida já armazenada. */
  linkPlayerMatch(puuid: string, match: StoredMatch): void {
    const p = match.participants.find((x) => x.puuid === puuid);
    if (!p) return;
    this.db
      .prepare(
        `INSERT OR REPLACE INTO player_matches (puuid, match_id, game_creation, queue_id, champion_id, position, win, kills, deaths, assists, cs, gold, damage)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(puuid, match.matchId, match.gameCreation, match.queueId, p.championId, p.position, p.win ? 1 : 0, p.kills, p.deaths, p.assists, p.cs, p.gold, p.damage);
  }

  getMatch(matchId: string): StoredMatch | null {
    const r = this.db.prepare('SELECT data FROM matches WHERE match_id = ?').get(matchId) as { data: string } | undefined;
    return r ? (JSON.parse(r.data) as StoredMatch) : null;
  }

  getMatches(ids: string[]): StoredMatch[] {
    if (!ids.length) return [];
    const rows = this.db.prepare(`SELECT data FROM matches WHERE match_id IN (${ids.map(() => '?').join(',')})`).all(...ids) as Array<{ data: string }>;
    return rows.map((r) => JSON.parse(r.data) as StoredMatch).sort((a, b) => b.gameCreation - a.gameCreation);
  }

  /** IDs das partidas mais recentes já armazenadas de uma conta (uso offline / fallback). */
  recentPlayerMatchIds(puuid: string, limit: number): string[] {
    return (this.db.prepare('SELECT match_id FROM player_matches WHERE puuid = ? ORDER BY game_creation DESC LIMIT ?').all(puuid, limit) as Array<{ match_id: string }>).map(
      (r) => r.match_id,
    );
  }

  countPlayerMatches(puuid: string): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM player_matches WHERE puuid = ?').get(puuid) as { n: number }).n;
  }

  // ---- Linha do tempo --------------------------------------------------------

  getTimeline<T>(matchId: string): T | null {
    const r = this.db.prepare('SELECT data FROM match_timelines WHERE match_id = ?').get(matchId) as { data: string } | undefined;
    return r ? (JSON.parse(r.data) as T) : null;
  }

  saveTimeline(matchId: string, data: unknown, now: number): void {
    this.db.prepare('INSERT OR REPLACE INTO match_timelines (match_id, data, fetched_at) VALUES (?, ?, ?)').run(matchId, JSON.stringify(data), now);
  }

  // ---- Snapshots de elo ------------------------------------------------------

  lastSnapshot(puuid: string, queue: 'SOLO' | 'FLEX'): RankSnapshot | null {
    const r = this.db.prepare('SELECT * FROM rank_snapshots WHERE puuid = ? AND queue = ? ORDER BY observed_at DESC LIMIT 1').get(puuid, queue) as
      | Record<string, unknown>
      | undefined;
    return r ? toSnapshot(r) : null;
  }

  addSnapshot(puuid: string, queue: 'SOLO' | 'FLEX', rank: Rank, wins: number, losses: number, now: number): void {
    this.db
      .prepare('INSERT INTO rank_snapshots (puuid, queue, tier, division, lp, wins, losses, observed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(puuid, queue, rank.tier, rank.division, rank.lp, wins, losses, now);
  }

  snapshots(puuid: string): RankSnapshot[] {
    return (this.db.prepare('SELECT * FROM rank_snapshots WHERE puuid = ? ORDER BY observed_at ASC').all(puuid) as Array<Record<string, unknown>>).map(toSnapshot);
  }

  // ---- Maestria --------------------------------------------------------------

  replaceMastery(puuid: string, rows: MasteryRow[], now: number): void {
    this.db.prepare('DELETE FROM champion_mastery WHERE puuid = ?').run(puuid);
    const stmt = this.db.prepare('INSERT INTO champion_mastery (puuid, champion_id, level, points, last_play_time, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
    for (const r of rows) stmt.run(puuid, r.championId, r.level, r.points, r.lastPlayTime, now);
  }

  mastery(puuid: string): MasteryRow[] {
    return (this.db.prepare('SELECT * FROM champion_mastery WHERE puuid = ? ORDER BY points DESC').all(puuid) as Array<Record<string, unknown>>).map((r) => ({
      championId: Number(r.champion_id),
      level: Number(r.level),
      points: Number(r.points),
      lastPlayTime: Number(r.last_play_time),
    }));
  }

  // ---- Histórico de atualizações --------------------------------------------

  startSync(puuid: string, requested: number, now: number): number {
    return Number(this.db.prepare("INSERT INTO sync_log (puuid, started_at, requested, status) VALUES (?, ?, ?, 'running')").run(puuid, now, requested).lastInsertRowid);
  }

  finishSync(id: number, status: 'ok' | 'error', fetchedNew: number, error: string | null, now: number): void {
    this.db.prepare('UPDATE sync_log SET finished_at = ?, status = ?, fetched_new = ?, error = ? WHERE id = ?').run(now, status, fetchedNew, error, id);
  }

  lastSuccessfulSync(puuid: string): number | null {
    const r = this.db.prepare("SELECT MAX(finished_at) AS t FROM sync_log WHERE puuid = ? AND status = 'ok'").get(puuid) as { t: number | null };
    return r.t ?? null;
  }

  syncHistory(puuid: string, limit = 20) {
    return this.db.prepare('SELECT started_at, finished_at, requested, fetched_new, status, error FROM sync_log WHERE puuid = ? ORDER BY id DESC LIMIT ?').all(puuid, limit);
  }

  // ---- Cache -----------------------------------------------------------------

  cacheGet<T>(key: string, now: number, allowExpired = false): T | null {
    const r = this.db.prepare('SELECT value, expires_at FROM cache WHERE key = ?').get(key) as { value: string; expires_at: number } | undefined;
    if (!r || (!allowExpired && r.expires_at <= now)) return null;
    return JSON.parse(r.value) as T;
  }

  cacheSet(key: string, value: unknown, ttlMs: number, now: number): void {
    this.db.prepare('INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)').run(key, JSON.stringify(value), now + ttlMs);
  }
}

function toAccount(r: Record<string, unknown>): AccountRow {
  return {
    puuid: String(r.puuid),
    gameName: String(r.game_name),
    tagLine: String(r.tag_line),
    region: String(r.region) as Region,
    summonerLevel: Number(r.summoner_level),
    profileIconId: Number(r.profile_icon_id),
    firstSeenAt: Number(r.first_seen_at),
    updatedAt: Number(r.updated_at),
  };
}

function toSnapshot(r: Record<string, unknown>): RankSnapshot {
  return {
    t: Number(r.observed_at),
    queue: String(r.queue) as 'SOLO' | 'FLEX',
    rank: { tier: String(r.tier) as Rank['tier'], division: Number(r.division) as Rank['division'], lp: Number(r.lp) },
    wins: Number(r.wins),
    losses: Number(r.losses),
  };
}
