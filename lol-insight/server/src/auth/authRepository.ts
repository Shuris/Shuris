import type { DatabaseSync } from 'node:sqlite';

import type { Region } from '../../../src/types/index.ts';

export interface UserRow {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt: number | null;
  passwordChangedAt: number;
  createdAt: number;
}

export interface SessionRow {
  id: string;
  userId: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  client: string;
  ip: string;
  createdAt: number;
  lastUsedAt: number;
  revokedAt: number | null;
}

export interface CodeTokenRow {
  id: string;
  userId: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
}

export interface RiotAccountRow {
  id: string;
  userId: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  region: Region;
  verificationStatus: 'unverified' | 'rso_verified';
  isPrimary: boolean;
  linkedAt: number;
  verifiedAt: number | null;
}

export interface SettingsRow {
  matchCount: 10 | 20 | 50 | 100;
  preferredRegion: Region | null;
  updatedAt: number;
}

const user = (r: Record<string, unknown>): UserRow => ({
  id: String(r.id),
  username: String(r.username),
  email: String(r.email),
  passwordHash: String(r.password_hash),
  emailVerifiedAt: r.email_verified_at === null ? null : Number(r.email_verified_at),
  passwordChangedAt: Number(r.password_changed_at),
  createdAt: Number(r.created_at),
});

const session = (r: Record<string, unknown>): SessionRow => ({
  id: String(r.id),
  userId: String(r.user_id),
  accessExpiresAt: Number(r.access_expires_at),
  refreshExpiresAt: Number(r.refresh_expires_at),
  client: String(r.client),
  ip: String(r.ip),
  createdAt: Number(r.created_at),
  lastUsedAt: Number(r.last_used_at),
  revokedAt: r.revoked_at === null ? null : Number(r.revoked_at),
});

const riot = (r: Record<string, unknown>): RiotAccountRow => ({
  id: String(r.id),
  userId: String(r.user_id),
  puuid: String(r.puuid),
  gameName: String(r.game_name),
  tagLine: String(r.tag_line),
  region: String(r.region) as Region,
  verificationStatus: String(r.verification_status) as RiotAccountRow['verificationStatus'],
  isPrimary: Number(r.is_primary) === 1,
  linkedAt: Number(r.linked_at),
  verifiedAt: r.verified_at === null ? null : Number(r.verified_at),
});

type CodeTable = 'email_verification_tokens' | 'password_reset_tokens';

/** SQL das contas de usuário. Toda consulta de dado pessoal filtra pelo ID do usuário. */
export class AuthRepository {
  constructor(private db: DatabaseSync) {}

  private get(sql: string, ...args: Array<string | number | null>) {
    return this.db.prepare(sql).get(...args) as Record<string, unknown> | undefined;
  }

  private run(sql: string, ...args: Array<string | number | null>) {
    return this.db.prepare(sql).run(...args);
  }

  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  // ---- Usuários ----

  createUser(u: { id: string; username: string; email: string; passwordHash: string; now: number }): void {
    this.run(
      'INSERT INTO users (id, username, email, password_hash, email_verified_at, password_changed_at, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)',
      u.id, u.username, u.email, u.passwordHash, u.now, u.now, u.now,
    );
    this.run('INSERT INTO user_settings (user_id, match_count, preferred_region, updated_at) VALUES (?, 20, NULL, ?)', u.id, u.now);
  }

  userById(id: string): UserRow | null {
    const r = this.get('SELECT * FROM users WHERE id = ?', id);
    return r ? user(r) : null;
  }

  userByEmail(email: string): UserRow | null {
    const r = this.get('SELECT * FROM users WHERE email = ?', email);
    return r ? user(r) : null;
  }

  usernameTaken(username: string): boolean {
    return !!this.get('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE', username);
  }

  emailTaken(email: string): boolean {
    return !!this.get('SELECT 1 FROM users WHERE email = ?', email);
  }

  setPassword(userId: string, passwordHash: string, now: number, changed = true): void {
    if (changed) this.run('UPDATE users SET password_hash = ?, password_changed_at = ?, updated_at = ? WHERE id = ?', passwordHash, now, now, userId);
    else this.run('UPDATE users SET password_hash = ? WHERE id = ?', passwordHash, userId);
  }

  markEmailVerified(userId: string, now: number): void {
    this.run('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?', now, now, userId);
  }

  /** Exclui o usuário; as chaves estrangeiras apagam em cascata todos os dados pessoais. */
  deleteUser(userId: string): void {
    this.run('DELETE FROM users WHERE id = ?', userId);
  }

  // ---- Sessões ----

  createSession(s: { id: string; userId: string; accessHash: string; accessExpiresAt: number; refreshHash: string; refreshExpiresAt: number; client: string; ip: string; now: number }): void {
    this.run(
      `INSERT INTO user_sessions (id, user_id, access_hash, access_expires_at, refresh_hash, refresh_expires_at, previous_refresh_hash, client, ip, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
      s.id, s.userId, s.accessHash, s.accessExpiresAt, s.refreshHash, s.refreshExpiresAt, s.client, s.ip, s.now, s.now,
    );
  }

  sessionByAccess(accessHash: string): SessionRow | null {
    const r = this.get('SELECT * FROM user_sessions WHERE access_hash = ?', accessHash);
    return r ? session(r) : null;
  }

  sessionByRefresh(refreshHash: string): SessionRow | null {
    const r = this.get('SELECT * FROM user_sessions WHERE refresh_hash = ?', refreshHash);
    return r ? session(r) : null;
  }

  sessionByPreviousRefresh(refreshHash: string): SessionRow | null {
    const r = this.get('SELECT * FROM user_sessions WHERE previous_refresh_hash = ?', refreshHash);
    return r ? session(r) : null;
  }

  rotateSession(id: string, t: { accessHash: string; accessExpiresAt: number; refreshHash: string; refreshExpiresAt: number; previousRefreshHash: string; ip: string; now: number }): void {
    this.run(
      `UPDATE user_sessions SET access_hash = ?, access_expires_at = ?, refresh_hash = ?, refresh_expires_at = ?, previous_refresh_hash = ?, ip = ?, last_used_at = ?
       WHERE id = ? AND revoked_at IS NULL`,
      t.accessHash, t.accessExpiresAt, t.refreshHash, t.refreshExpiresAt, t.previousRefreshHash, t.ip, t.now, id,
    );
  }

  touchSession(id: string, now: number): void {
    this.run('UPDATE user_sessions SET last_used_at = ? WHERE id = ?', now, id);
  }

  revokeSession(id: string, userId: string, reason: string, now: number): boolean {
    return Number(this.run('UPDATE user_sessions SET revoked_at = ?, revoked_reason = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL', now, reason, id, userId).changes) > 0;
  }

  revokeAllSessions(userId: string, reason: string, now: number, exceptId: string | null = null): number {
    return Number(
      this.run('UPDATE user_sessions SET revoked_at = ?, revoked_reason = ? WHERE user_id = ? AND revoked_at IS NULL AND id IS NOT ?', now, reason, userId, exceptId).changes,
    );
  }

  activeSessions(userId: string, now: number): SessionRow[] {
    return (this.db.prepare('SELECT * FROM user_sessions WHERE user_id = ? AND revoked_at IS NULL AND refresh_expires_at > ? ORDER BY last_used_at DESC').all(userId, now) as Array<Record<string, unknown>>).map(session);
  }

  // ---- Códigos por e-mail ----

  /** Cria um código novo e invalida os anteriores do mesmo tipo. */
  createCode(table: CodeTable, t: { id: string; userId: string; codeHash: string; expiresAt: number; now: number }): void {
    this.run(`UPDATE ${table} SET used_at = ? WHERE user_id = ? AND used_at IS NULL`, t.now, t.userId);
    this.run(`INSERT INTO ${table} (id, user_id, code_hash, expires_at, attempts, used_at, created_at) VALUES (?, ?, ?, ?, 0, NULL, ?)`, t.id, t.userId, t.codeHash, t.expiresAt, t.now);
  }

  activeCode(table: CodeTable, userId: string, now: number): CodeTokenRow | null {
    const r = this.get(`SELECT * FROM ${table} WHERE user_id = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1`, userId, now);
    return r ? { id: String(r.id), userId: String(r.user_id), codeHash: String(r.code_hash), expiresAt: Number(r.expires_at), attempts: Number(r.attempts) } : null;
  }

  addCodeAttempt(table: CodeTable, id: string): void {
    this.run(`UPDATE ${table} SET attempts = attempts + 1 WHERE id = ?`, id);
  }

  useCode(table: CodeTable, id: string, now: number): void {
    this.run(`UPDATE ${table} SET used_at = ? WHERE id = ?`, now, id);
  }

  // ---- Contas Riot ----

  riotAccounts(userId: string): RiotAccountRow[] {
    return (this.db.prepare('SELECT * FROM riot_accounts WHERE user_id = ? ORDER BY is_primary DESC, linked_at ASC').all(userId) as Array<Record<string, unknown>>).map(riot);
  }

  riotAccount(userId: string, id: string): RiotAccountRow | null {
    const r = this.get('SELECT * FROM riot_accounts WHERE id = ? AND user_id = ?', id, userId);
    return r ? riot(r) : null;
  }

  primaryRiotAccount(userId: string): RiotAccountRow | null {
    const r = this.get('SELECT * FROM riot_accounts WHERE user_id = ? AND is_primary = 1', userId);
    return r ? riot(r) : null;
  }

  riotAccountByPuuid(userId: string, puuid: string): RiotAccountRow | null {
    const r = this.get('SELECT * FROM riot_accounts WHERE user_id = ? AND puuid = ?', userId, puuid);
    return r ? riot(r) : null;
  }

  insertRiotAccount(a: { id: string; userId: string; puuid: string; gameName: string; tagLine: string; region: Region; primary: boolean; now: number }): void {
    this.run(
      `INSERT INTO riot_accounts (id, user_id, puuid, game_name, tag_line, region, verification_status, is_primary, linked_at)
       VALUES (?, ?, ?, ?, ?, ?, 'unverified', ?, ?)`,
      a.id, a.userId, a.puuid, a.gameName, a.tagLine, a.region, a.primary ? 1 : 0, a.now,
    );
  }

  /** Marca uma conta vinculada como comprovada pelo RSO e guarda os tokens (já criptografados). */
  markRiotVerified(id: string, v: { subject: string; accessEnc: string; refreshEnc: string | null; expiresAt: number | null; gameName: string | null; tagLine: string | null; now: number }): void {
    this.run(
      `UPDATE riot_accounts SET verification_status = 'rso_verified', verified_at = ?, rso_subject = ?, rso_access_token_enc = ?, rso_refresh_token_enc = ?,
       rso_token_expires_at = ?, game_name = COALESCE(?, game_name), tag_line = COALESCE(?, tag_line) WHERE id = ?`,
      v.now, v.subject, v.accessEnc, v.refreshEnc, v.expiresAt, v.gameName, v.tagLine, id,
    );
  }

  setPrimaryRiotAccount(userId: string, id: string): void {
    this.transaction(() => {
      this.run('UPDATE riot_accounts SET is_primary = 0 WHERE user_id = ?', userId);
      this.run('UPDATE riot_accounts SET is_primary = 1 WHERE user_id = ? AND id = ?', userId, id);
    });
  }

  deleteRiotAccount(userId: string, id: string): boolean {
    return Number(this.run('DELETE FROM riot_accounts WHERE user_id = ? AND id = ?', userId, id).changes) > 0;
  }

  // ---- Configurações ----

  settings(userId: string): SettingsRow {
    const r = this.get('SELECT * FROM user_settings WHERE user_id = ?', userId);
    return r
      ? { matchCount: Number(r.match_count) as SettingsRow['matchCount'], preferredRegion: (r.preferred_region as Region | null) ?? null, updatedAt: Number(r.updated_at) }
      : { matchCount: 20, preferredRegion: null, updatedAt: 0 };
  }

  saveSettings(userId: string, s: Omit<SettingsRow, 'updatedAt'>, now: number): void {
    this.run(
      `INSERT INTO user_settings (user_id, match_count, preferred_region, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET match_count = excluded.match_count, preferred_region = excluded.preferred_region, updated_at = excluded.updated_at`,
      userId, s.matchCount, s.preferredRegion, now,
    );
  }

  // ---- RSO (estado do fluxo OAuth) ----

  saveOAuthState(s: { state: string; userId: string; codeVerifier: string; nonce: string; now: number; expiresAt: number }): void {
    this.run('INSERT INTO oauth_states (state, user_id, code_verifier, nonce, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)', s.state, s.userId, s.codeVerifier, s.nonce, s.now, s.expiresAt);
  }

  /** Consome o state (uso único). */
  takeOAuthState(state: string, now: number): { userId: string; codeVerifier: string; nonce: string } | null {
    const r = this.get('SELECT * FROM oauth_states WHERE state = ? AND expires_at > ?', state, now);
    this.run('DELETE FROM oauth_states WHERE state = ?', state);
    return r ? { userId: String(r.user_id), codeVerifier: String(r.code_verifier), nonce: String(r.nonce) } : null;
  }

  /** Quantos registros pessoais existem para o usuário (usado nos testes de exclusão de conta). */
  personalRowCount(userId: string): number {
    const tables = [
      'user_sessions', 'email_verification_tokens', 'password_reset_tokens', 'riot_accounts', 'oauth_states', 'user_settings',
      'academy_progress', 'academy_quiz_attempts', 'academy_activity', 'academy_plans', 'academy_diagnoses', 'rank_predictions',
      'rank_goals', 'challenge_progress', 'replay_analyses', 'matchup_notes', 'challenge_profile',
    ];
    return tables.reduce((n, t) => n + (this.get(`SELECT COUNT(*) AS n FROM ${t} WHERE user_id = ?`, userId) as { n: number }).n, 0);
  }
}
