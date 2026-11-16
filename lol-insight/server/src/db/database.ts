import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Banco SQLite (módulo nativo do Node, sem dependências).
 *
 * O acesso fica isolado em repositories.ts: para escalar a múltiplos
 * servidores basta reimplementar os repositórios sobre PostgreSQL — o esquema
 * usa apenas tipos e chaves portáveis.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  puuid            TEXT PRIMARY KEY,
  game_name        TEXT NOT NULL,
  tag_line         TEXT NOT NULL,
  region           TEXT NOT NULL,
  summoner_level   INTEGER NOT NULL DEFAULT 0,
  profile_icon_id  INTEGER NOT NULL DEFAULT 0,
  first_seen_at    INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_accounts_riot_id ON accounts (region, game_name COLLATE NOCASE, tag_line COLLATE NOCASE);

-- Partida completa (os dez participantes), compartilhada entre contas acompanhadas.
CREATE TABLE IF NOT EXISTS matches (
  match_id       TEXT PRIMARY KEY,
  region         TEXT NOT NULL,
  queue_id       INTEGER NOT NULL,
  game_creation  INTEGER NOT NULL,
  duration_sec   INTEGER NOT NULL,
  data           TEXT NOT NULL,
  fetched_at     INTEGER NOT NULL
);

-- Estatísticas individuais: uma linha por conta acompanhada em cada partida.
CREATE TABLE IF NOT EXISTS player_matches (
  puuid          TEXT NOT NULL,
  match_id       TEXT NOT NULL,
  game_creation  INTEGER NOT NULL,
  queue_id       INTEGER NOT NULL,
  champion_id    INTEGER NOT NULL,
  position       TEXT NOT NULL,
  win            INTEGER NOT NULL,
  kills          INTEGER NOT NULL,
  deaths         INTEGER NOT NULL,
  assists        INTEGER NOT NULL,
  cs             INTEGER NOT NULL,
  gold           INTEGER NOT NULL,
  damage         INTEGER NOT NULL,
  PRIMARY KEY (puuid, match_id)
);
CREATE INDEX IF NOT EXISTS idx_player_matches_recent ON player_matches (puuid, game_creation DESC);

CREATE TABLE IF NOT EXISTS match_timelines (
  match_id    TEXT PRIMARY KEY,
  data        TEXT NOT NULL,
  fetched_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rank_snapshots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  puuid        TEXT NOT NULL,
  queue        TEXT NOT NULL,
  tier         TEXT NOT NULL,
  division     INTEGER NOT NULL,
  lp           INTEGER NOT NULL,
  wins         INTEGER NOT NULL,
  losses       INTEGER NOT NULL,
  observed_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rank_snapshots ON rank_snapshots (puuid, queue, observed_at);

CREATE TABLE IF NOT EXISTS champion_mastery (
  puuid           TEXT NOT NULL,
  champion_id     INTEGER NOT NULL,
  level           INTEGER NOT NULL,
  points          INTEGER NOT NULL,
  last_play_time  INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  PRIMARY KEY (puuid, champion_id)
);

-- Histórico de atualizações (cada coleta de partidas de uma conta).
CREATE TABLE IF NOT EXISTS sync_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  puuid        TEXT NOT NULL,
  started_at   INTEGER NOT NULL,
  finished_at  INTEGER,
  requested    INTEGER NOT NULL,
  fetched_new  INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL,
  error        TEXT
);

-- ---- Treinador: Academy e Rank Predictor (chave = puuid da conta acompanhada) ----

CREATE TABLE IF NOT EXISTS lesson_progress (
  puuid         TEXT NOT NULL,
  lesson_id     TEXT NOT NULL,
  completed_at  INTEGER,
  best_score    REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (puuid, lesson_id)
);

-- Respostas dos testes: acertos, erros e tempo de cada tentativa.
CREATE TABLE IF NOT EXISTS quiz_attempts (
  puuid         TEXT NOT NULL,
  lesson_id     TEXT NOT NULL,
  at            INTEGER NOT NULL,
  correct       INTEGER NOT NULL,
  total         INTEGER NOT NULL,
  duration_sec  INTEGER NOT NULL,
  answers       TEXT NOT NULL,
  PRIMARY KEY (puuid, lesson_id, at)
);

CREATE TABLE IF NOT EXISTS training_activity (
  puuid  TEXT NOT NULL,
  day    TEXT NOT NULL,
  PRIMARY KEY (puuid, day)
);

CREATE TABLE IF NOT EXISTS diagnoses (
  puuid   TEXT NOT NULL,
  at      INTEGER NOT NULL,
  sample  INTEGER NOT NULL,
  data    TEXT NOT NULL,
  PRIMARY KEY (puuid, at)
);

-- Plano ativo (active = 1, data = plano completo) e planos anteriores (active = 0, data = resumo).
CREATE TABLE IF NOT EXISTS training_plans (
  puuid       TEXT NOT NULL,
  plan_id     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  focus       TEXT NOT NULL,
  active      INTEGER NOT NULL,
  data        TEXT NOT NULL,
  PRIMARY KEY (puuid, plan_id)
);

CREATE TABLE IF NOT EXISTS rank_predictions (
  puuid  TEXT NOT NULL,
  at     INTEGER NOT NULL,
  data   TEXT NOT NULL,
  PRIMARY KEY (puuid, at)
);

CREATE TABLE IF NOT EXISTS rank_goals (
  puuid     TEXT PRIMARY KEY,
  tier      TEXT NOT NULL,
  division  INTEGER NOT NULL,
  lp        INTEGER NOT NULL,
  set_at    INTEGER NOT NULL
);

-- Cache genérico com validade (respostas de perfil, Data Dragon etc.).
CREATE TABLE IF NOT EXISTS cache (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  expires_at  INTEGER NOT NULL
);
`;

/**
 * Migração 2 — contas de usuário.
 *
 * Tudo o que é pessoal passa a pertencer a um usuário (`users.id`) e é apagado
 * em cascata quando a conta é excluída. Dados públicos da Riot (partidas,
 * contas pesquisadas, snapshots de elo) continuam compartilhados por PUUID e não
 * são duplicados por usuário.
 */
const SCHEMA_V2 = `
CREATE TABLE users (
  id                   TEXT PRIMARY KEY,           -- "usr_" + 24 hex aleatórios; nunca muda
  username             TEXT NOT NULL,
  email                TEXT NOT NULL,              -- sempre em minúsculas
  password_hash        TEXT NOT NULL,              -- scrypt, com parâmetros e sal no próprio valor
  email_verified_at    INTEGER,
  password_changed_at  INTEGER NOT NULL,
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);
CREATE UNIQUE INDEX users_username ON users (username COLLATE NOCASE);
CREATE UNIQUE INDEX users_email ON users (email);

-- Tokens guardados apenas como hash SHA-256: um vazamento do banco não entrega sessões.
CREATE TABLE user_sessions (
  id                     TEXT PRIMARY KEY,
  user_id                TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  access_hash            TEXT NOT NULL UNIQUE,
  access_expires_at      INTEGER NOT NULL,
  refresh_hash           TEXT NOT NULL UNIQUE,
  refresh_expires_at     INTEGER NOT NULL,
  previous_refresh_hash  TEXT,                     -- detecta reuso de um token de renovação já trocado
  client                 TEXT NOT NULL,
  ip                     TEXT NOT NULL,
  created_at             INTEGER NOT NULL,
  last_used_at           INTEGER NOT NULL,
  revoked_at             INTEGER,
  revoked_reason         TEXT
);
CREATE INDEX user_sessions_user ON user_sessions (user_id);
CREATE INDEX user_sessions_previous ON user_sessions (previous_refresh_hash);

CREATE TABLE email_verification_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,                       -- HMAC do código com o segredo do servidor
  expires_at  INTEGER NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  used_at     INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX email_verification_tokens_user ON email_verification_tokens (user_id);

CREATE TABLE password_reset_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  used_at     INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX password_reset_tokens_user ON password_reset_tokens (user_id);

-- Conta Riot vinculada. "unverified": Riot ID informado pelo usuário, sem prova de posse.
-- "rso_verified": reservado para o Riot Sign On, que depende de aprovação da Riot.
CREATE TABLE riot_accounts (
  id                     TEXT PRIMARY KEY,
  user_id                TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  puuid                  TEXT NOT NULL,
  game_name              TEXT NOT NULL,
  tag_line               TEXT NOT NULL,
  region                 TEXT NOT NULL,
  verification_status    TEXT NOT NULL CHECK (verification_status IN ('unverified', 'rso_verified')),
  is_primary             INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  linked_at              INTEGER NOT NULL,
  verified_at            INTEGER,
  rso_subject            TEXT,
  rso_access_token_enc   TEXT,                     -- AES-256-GCM, chave derivada do segredo do servidor
  rso_refresh_token_enc  TEXT,
  rso_token_expires_at   INTEGER,
  UNIQUE (user_id, puuid)
);
-- Uma conta Riot só pode ser comprovada (RSO) por um usuário; perfis não verificados podem se repetir.
CREATE UNIQUE INDEX riot_accounts_verified_puuid ON riot_accounts (puuid) WHERE verification_status = 'rso_verified';
CREATE UNIQUE INDEX riot_accounts_primary ON riot_accounts (user_id) WHERE is_primary = 1;

-- Estado do fluxo OAuth2/OIDC do RSO (state, PKCE e nonce), de uso único.
CREATE TABLE oauth_states (
  state          TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_verifier  TEXT NOT NULL,
  nonce          TEXT NOT NULL,
  created_at     INTEGER NOT NULL,
  expires_at     INTEGER NOT NULL
);

CREATE TABLE user_settings (
  user_id           TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  match_count       INTEGER NOT NULL DEFAULT 20 CHECK (match_count IN (10, 20, 50, 100)),
  preferred_region  TEXT,
  updated_at        INTEGER NOT NULL
);

-- ---- Academy e Rank Predictor, por usuário ----
CREATE TABLE academy_progress (
  user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  lesson_id     TEXT NOT NULL,
  completed_at  INTEGER,
  best_score    REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE academy_quiz_attempts (
  user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  lesson_id     TEXT NOT NULL,
  at            INTEGER NOT NULL,
  correct       INTEGER NOT NULL,
  total         INTEGER NOT NULL,
  duration_sec  INTEGER NOT NULL,
  answers       TEXT NOT NULL,
  PRIMARY KEY (user_id, lesson_id, at)
);

CREATE TABLE academy_activity (
  user_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  day      TEXT NOT NULL,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE academy_plans (
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  plan_id     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  focus       TEXT NOT NULL,
  active      INTEGER NOT NULL,
  data        TEXT NOT NULL,
  PRIMARY KEY (user_id, plan_id)
);

-- Diagnósticos, previsões e metas dependem da conta Riot analisada.
CREATE TABLE academy_diagnoses (
  user_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  puuid    TEXT NOT NULL,
  at       INTEGER NOT NULL,
  sample   INTEGER NOT NULL,
  data     TEXT NOT NULL,
  PRIMARY KEY (user_id, puuid, at)
);

CREATE TABLE rank_predictions (
  user_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  puuid    TEXT NOT NULL,
  at       INTEGER NOT NULL,
  data     TEXT NOT NULL,
  PRIMARY KEY (user_id, puuid, at)
);

CREATE TABLE rank_goals (
  user_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  puuid     TEXT NOT NULL,
  tier      TEXT NOT NULL,
  division  INTEGER NOT NULL,
  lp        INTEGER NOT NULL,
  set_at    INTEGER NOT NULL,
  PRIMARY KEY (user_id, puuid)
);

-- Estrutura para funcionalidades ainda não implementadas (LOL Challenge e Replay Challenges).
CREATE TABLE challenge_progress (
  user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  challenge_id  TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('active', 'completed', 'failed', 'abandoned')),
  progress      TEXT NOT NULL DEFAULT '{}',
  started_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  completed_at  INTEGER,
  PRIMARY KEY (user_id, challenge_id)
);

CREATE TABLE replay_analyses (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  match_id    TEXT NOT NULL,
  puuid       TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '{}',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (user_id, match_id)
);

-- Contador de tentativas (login, códigos, cadastro) que sobrevive a reinícios do servidor.
CREATE TABLE auth_throttle (
  key  TEXT NOT NULL,
  at   INTEGER NOT NULL
);
CREATE INDEX auth_throttle_key ON auth_throttle (key, at);
`;

/** Tabelas do treinador da versão 1, que eram indexadas por PUUID e não pertenciam a ninguém. */
const V1_COACH_TABLES = ['lesson_progress', 'quiz_attempts', 'training_activity', 'diagnoses', 'training_plans', 'rank_predictions', 'rank_goals'];

interface Migration {
  version: number;
  description: string;
  up: (db: DatabaseSync) => void;
}

export const MIGRATIONS: Migration[] = [
  { version: 1, description: 'Esquema inicial: contas Riot, partidas, snapshots, treinador por PUUID', up: (db) => db.exec(SCHEMA) },
  {
    version: 2,
    description: 'Contas de usuário, sessões, vinculação Riot e dados pessoais por usuário',
    up: (db) => {
      // O progresso antigo do treinador era anônimo (chave = PUUID pesquisado). Ele não pode ser
      // atribuído a nenhum usuário com segurança: tabelas com dados viram legacy_*, vazias são removidas.
      for (const table of V1_COACH_TABLES) {
        const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
        if (!exists) continue;
        const rows = (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
        if (rows > 0) db.exec(`ALTER TABLE ${table} RENAME TO legacy_${table}`);
        else db.exec(`DROP TABLE ${table}`);
      }
      db.exec(SCHEMA_V2);
    },
  },
  {
    version: 3,
    description: 'Caderno de matchups (anotações por usuário)',
    up: (db) =>
      db.exec(`
CREATE TABLE IF NOT EXISTS matchup_notes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  champion_id TEXT NOT NULL,
  opponent_id TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('facil', 'equilibrado', 'dificil')),
  note TEXT NOT NULL CHECK (length(note) <= 1000),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, champion_id, opponent_id)
);`),
  },
  {
    version: 4,
    description: 'LOL Challenge: participação opcional no ranking',
    up: (db) =>
      db.exec(`
CREATE TABLE IF NOT EXISTS challenge_profile (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ranking_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (ranking_opt_in IN (0, 1)),
  updated_at INTEGER NOT NULL
);`),
  },
];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

/** Aplica, em ordem e dentro de transação, as migrações ainda não aplicadas (controle por PRAGMA user_version). */
export function migrate(db: DatabaseSync): { from: number; to: number } {
  const from = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  for (const m of MIGRATIONS) {
    if (m.version <= from) continue;
    db.exec('BEGIN');
    try {
      m.up(db);
      db.exec(`PRAGMA user_version = ${m.version}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw new Error(`Falha na migração ${m.version} (${m.description}): ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { from, to: Math.max(from, SCHEMA_VERSION) };
}

export function openDatabase(file: string): DatabaseSync {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  migrate(db);
  return db;
}
