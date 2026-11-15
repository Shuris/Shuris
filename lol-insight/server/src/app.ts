import type { DatabaseSync } from 'node:sqlite';

import type { Config } from './config.ts';
import { openDatabase } from './db/database.ts';
import { Repositories } from './db/repositories.ts';
import { DataDragon } from './ddragon.ts';
import { consoleLogger, type Logger } from './logger.ts';
import { RiotApi } from './riot/api.ts';
import { RiotClient, type FetchLike } from './riot/client.ts';
import { RateLimiter, systemClock, type Clock } from './riot/rateLimiter.ts';
import { AccountService } from './services/accountService.ts';
import { SyncService } from './services/syncService.ts';

export interface AppOverrides {
  fetchImpl?: FetchLike;
  ddragonFetch?: (url: string) => Promise<unknown>;
  clock?: Clock;
  logger?: Logger;
}

export interface App {
  db: DatabaseSync;
  repos: Repositories;
  limiter: RateLimiter;
  client: RiotClient;
  sync: SyncService;
  accounts: AccountService;
  logger: Logger;
}

/** Monta as dependências do backend. Os pontos de entrada externos (rede, relógio) são injetáveis para os testes. */
export function createApp(config: Config, overrides: AppOverrides = {}): App {
  const logger = overrides.logger ?? consoleLogger;
  const clock = overrides.clock ?? systemClock;
  const now = () => clock.now();
  const db = openDatabase(config.databaseFile);
  const repos = new Repositories(db);
  const limiter = new RateLimiter(config.rateLimits, clock);
  const client = new RiotClient({ apiKey: config.riotApiKey, limiter, fetchImpl: overrides.fetchImpl, logger, clock });
  const api = new RiotApi(client);
  const ddragon = new DataDragon(repos, config.ddragonLocale, overrides.ddragonFetch, logger, now);
  const sync = new SyncService(api, repos, limiter, logger, now);
  const accounts = new AccountService(api, repos, sync, ddragon, logger, now, (ms) => clock.sleep(ms));
  return { db, repos, limiter, client, sync, accounts, logger };
}
