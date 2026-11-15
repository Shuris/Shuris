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

export function openDatabase(file: string): DatabaseSync {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}
