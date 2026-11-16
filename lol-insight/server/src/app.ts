import type { DatabaseSync } from 'node:sqlite';

import type { Config } from './config.ts';
import { openDatabase } from './db/database.ts';
import { Repositories } from './db/repositories.ts';
import { DataDragon } from './ddragon.ts';
import { consoleLogger, type Logger } from './logger.ts';
import { RiotApi } from './riot/api.ts';
import { RiotClient, type FetchLike } from './riot/client.ts';
import { RateLimiter, systemClock, type Clock } from './riot/rateLimiter.ts';
import { AuthRepository } from './auth/authRepository.ts';
import { AuthService } from './auth/authService.ts';
import { TokenCipher } from './auth/crypto.ts';
import { ConsoleMailer, type Mailer } from './auth/mailer.ts';
import { RiotLinkService } from './auth/riotLinkService.ts';
import { RsoService } from './auth/rso.ts';
import { Throttle } from './auth/throttle.ts';
import { CoachRepository } from './coach/coachRepository.ts';
import { AcademyService, LessonService, LPHistoryService, PlayerDiagnosisService, RankPredictionService, TrainingPlanService } from './coach/services.ts';
import { AccountService } from './services/accountService.ts';
import { SyncService } from './services/syncService.ts';

export interface AppOverrides {
  fetchImpl?: FetchLike;
  ddragonFetch?: (url: string) => Promise<unknown>;
  clock?: Clock;
  logger?: Logger;
  mailer?: Mailer;
  rsoFetch?: ConstructorParameters<typeof RsoService>[3];
}

export interface App {
  db: DatabaseSync;
  repos: Repositories;
  limiter: RateLimiter;
  client: RiotClient;
  sync: SyncService;
  accounts: AccountService;
  coachStore: CoachRepository;
  lessons: LessonService;
  lpHistory: LPHistoryService;
  diagnosis: PlayerDiagnosisService;
  trainingPlans: TrainingPlanService;
  rankPredictions: RankPredictionService;
  academy: AcademyService;
  authRepo: AuthRepository;
  auth: AuthService;
  riotLinks: RiotLinkService;
  rso: RsoService;
  throttle: Throttle;
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
  const coachStore = new CoachRepository(db);
  const lessons = new LessonService();
  const lpHistory = new LPHistoryService(repos);
  const diagnosis = new PlayerDiagnosisService(coachStore);
  const trainingPlans = new TrainingPlanService();
  const rankPredictions = new RankPredictionService(coachStore, lpHistory);
  const authRepo = new AuthRepository(db);
  const throttle = new Throttle(db, now);
  const mailer = overrides.mailer ?? new ConsoleMailer(logger);
  const auth = new AuthService(authRepo, throttle, mailer, config.authSecret, config.passwordParams, logger, now);
  const riotLinks = new RiotLinkService(authRepo, accounts, now);
  const rso = new RsoService(config.rso, authRepo, new TokenCipher(config.authSecret), overrides.rsoFetch, now);
  const academy = new AcademyService(accounts, coachStore, authRepo, lessons, trainingPlans, rankPredictions, lpHistory, now);
  return { db, repos, limiter, client, sync, accounts, coachStore, lessons, lpHistory, diagnosis, trainingPlans, rankPredictions, academy, authRepo, auth, riotLinks, rso, throttle, logger };
}
