import type { Region, SyncStatus } from '../../../src/types/index.ts';
import type { Repositories } from '../db/repositories.ts';
import { AppError, RiotNotFoundError } from '../errors.ts';
import type { Logger } from '../logger.ts';
import { matchHost } from '../regions.ts';
import type { RiotApi } from '../riot/api.ts';
import type { RateLimiter } from '../riot/rateLimiter.ts';
import { toStoredMatch } from './normalize.ts';

export const ALLOWED_COUNTS = [10, 20, 50, 100] as const;

interface Job {
  puuid: string;
  region: Region;
  requested: number;
  ids: string[];
  /** Partidas do lote ainda não baixadas. */
  pending: number;
  running: boolean;
  finishedAt: number;
  error: AppError | null;
  done: Promise<void>;
}

/** Espera aceitável por rate limit durante a coleta em segundo plano (uma janela longa da Riot + folga). */
const BACKGROUND_WAIT_MS = 130_000;
const CONCURRENCY = 4;
/** Lista de IDs é reaproveitada por este tempo antes de consultar a Riot de novo. */
const IDS_TTL_MS = 60_000;

/**
 * Coleta do histórico de partidas.
 *
 * Roda em segundo plano: a rota HTTP responde com o que já está armazenado e o
 * app consulta de novo até o estado voltar a "idle" (carregamento progressivo).
 * Partidas já armazenadas nunca são baixadas novamente — elas são imutáveis.
 */
export class SyncService {
  private jobs = new Map<string, Job>();

  constructor(
    private api: RiotApi,
    private repos: Repositories,
    private limiter: RateLimiter,
    private logger: Logger,
    private now: () => number = Date.now,
  ) {}

  /** Garante que exista uma coleta cobrindo `count` partidas; devolve a promessa de conclusão. */
  ensure(puuid: string, region: Region, count: number, force = false): Promise<void> {
    const current = this.jobs.get(puuid);
    if (current?.running) {
      if (current.requested >= count) return current.done;
      // Pedido maior durante uma coleta: encadeia uma nova ao fim da atual.
      const chained = current.done.then(() => this.ensure(puuid, region, count, force));
      return chained;
    }
    const fresh = current && !current.error && current.requested >= count && this.now() - current.finishedAt < IDS_TTL_MS;
    if (fresh && !force) return current.done;

    const job: Job = { puuid, region, requested: count, ids: current?.ids ?? [], pending: 0, running: true, finishedAt: 0, error: null, done: Promise.resolve() };
    job.done = this.run(job);
    this.jobs.set(puuid, job);
    return job.done;
  }

  private async run(job: Job): Promise<void> {
    const logId = this.repos.startSync(job.puuid, job.requested, this.now());
    let fetched = 0;
    try {
      const ids = await this.api.matchIds(job.region, job.puuid, 0, job.requested, { maxWaitMs: BACKGROUND_WAIT_MS });
      job.ids = ids;
      const missing = this.repos.missingMatchIds(ids);
      job.pending = missing.length;

      // Partidas já armazenadas (por esta ou outra conta): apenas vincula ao jogador.
      const missingSet = new Set(missing);
      for (const m of this.repos.getMatches(ids.filter((id) => !missingSet.has(id)))) this.repos.linkPlayerMatch(job.puuid, m);

      const queue = [...missing];
      const worker = async () => {
        for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
          try {
            const dto = await this.api.match(job.region, id, { maxWaitMs: BACKGROUND_WAIT_MS });
            const stored = toStoredMatch(dto);
            this.repos.saveMatch(stored, job.region, this.now());
            this.repos.linkPlayerMatch(job.puuid, stored);
            fetched++;
          } catch (e) {
            // Partida removida/indisponível na Riot: segue para a próxima.
            if (!(e instanceof RiotNotFoundError)) throw e;
            this.logger.warn('sync: partida indisponível', { matchId: id });
          }
          job.pending--;
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
      this.repos.finishSync(logId, 'ok', fetched, null, this.now());
      this.logger.info('sync: concluída', { requested: job.requested, available: ids.length, fetched });
    } catch (e) {
      job.error = e instanceof AppError ? e : new AppError('INTERNAL', 'Falha inesperada ao coletar partidas.');
      this.repos.finishSync(logId, 'error', fetched, job.error.code, this.now());
      this.logger.warn('sync: interrompida', { code: job.error.code, fetched });
    } finally {
      job.running = false;
      job.finishedAt = this.now();
    }
  }

  /** IDs das partidas mais recentes conhecidas para a conta (da Riot ou, sem coleta, do banco). */
  matchIds(puuid: string, count: number): string[] {
    const job = this.jobs.get(puuid);
    if (job?.ids.length) return job.ids.slice(0, count);
    return this.repos.recentPlayerMatchIds(puuid, count);
  }

  status(puuid: string, count: number): SyncStatus {
    const job = this.jobs.get(puuid);
    const lastSyncedAt = this.repos.lastSuccessfulSync(puuid) ?? undefined;
    if (!job) {
      const stored = Math.min(count, this.repos.countPlayerMatches(puuid));
      return { state: 'idle', requested: count, available: stored, loaded: stored, lastSyncedAt };
    }
    const ids = job.ids.slice(0, count);
    const available = job.running && !job.ids.length ? count : ids.length;
    const loaded = ids.length - this.repos.missingMatchIds(ids).length;
    if (job.error) {
      const retryAfterSec = typeof job.error.details.retryAfterSec === 'number' ? job.error.details.retryAfterSec : undefined;
      return { state: 'error', requested: count, available, loaded, errorCode: job.error.code, message: job.error.message, retryAfterSec, lastSyncedAt };
    }
    if (job.running) {
      const waitMs = this.limiter.waitTime(matchHost(job.region));
      return waitMs > 1500
        ? { state: 'waiting_rate_limit', requested: count, available, loaded, retryAfterSec: Math.ceil(waitMs / 1000), lastSyncedAt }
        : { state: 'syncing', requested: count, available, loaded, lastSyncedAt };
    }
    return { state: 'idle', requested: count, available, loaded, lastSyncedAt };
  }

  /** Aguarda o término de todas as coletas em andamento (encerramento e testes). */
  async idle(): Promise<void> {
    await Promise.all([...this.jobs.values()].map((j) => j.done));
  }
}
