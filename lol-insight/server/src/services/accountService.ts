import type { Champion, MasteryEntry, MatchDetails, Player, PlayerBundle, Rank, RankedQueue, Region, Tier } from '../../../src/types/index.ts';
import type { DataDragon, StaticData } from '../ddragon.ts';
import type { AccountRow, Repositories } from '../db/repositories.ts';
import { AppError, RiotNotFoundError } from '../errors.ts';
import type { Logger } from '../logger.ts';
import { regionFromMatchId, regionFromPlatform } from '../regions.ts';
import type { RiotApi } from '../riot/api.ts';
import type { LeagueEntryDto } from '../riot/types.ts';
import { classify, toMatchDetails, toPlayerMatch } from './normalize.ts';
import type { SyncService } from './syncService.ts';

const TIERS: Record<string, Tier> = {
  IRON: 'FERRO',
  BRONZE: 'BRONZE',
  SILVER: 'PRATA',
  GOLD: 'OURO',
  PLATINUM: 'PLATINA',
  EMERALD: 'ESMERALDA',
  DIAMOND: 'DIAMANTE',
  MASTER: 'MESTRE',
  GRANDMASTER: 'GRAO_MESTRE',
  CHALLENGER: 'DESAFIANTE',
};
const DIVISIONS: Record<string, 1 | 2 | 3 | 4> = { I: 1, II: 2, III: 3, IV: 4 };

const ACCOUNT_TTL_MS = 10 * 60_000;
const PROFILE_TTL_MS = 2 * 60_000;
/** Mesmo sem mudança de elo, registra um snapshot a cada 6 h para a série histórica ter pontos regulares. */
const SNAPSHOT_INTERVAL_MS = 6 * 3_600_000;
/** Tempo que a rota espera a coleta antes de responder com o que já existe. */
const SYNC_WAIT_MS = 2500;
/** Erros da Riot diante dos quais ainda vale responder com os dados já armazenados. */
const SERVE_STORED_ON = new Set(['RATE_LIMITED', 'RIOT_UNAVAILABLE', 'RIOT_AUTH', 'MISSING_API_KEY']);

export function validateRiotId(gameName: string, tagLine: string): void {
  const name = gameName.trim();
  const tag = tagLine.trim();
  if (!name || !tag) throw new AppError('INVALID_RIOT_ID', 'Informe o Riot ID completo, no formato Nome#TAG.');
  if (name.length < 3 || name.length > 16 || /[#/\\]/.test(name)) {
    throw new AppError('INVALID_RIOT_ID', 'O nome do Riot ID deve ter de 3 a 16 caracteres.');
  }
  if (!/^[\p{L}\p{N}]{3,5}$/u.test(tag)) {
    throw new AppError('INVALID_RIOT_ID', 'A tag do Riot ID deve ter de 3 a 5 letras ou números (ex.: BR1).');
  }
}

export function toRank(entry: LeagueEntryDto): Rank | null {
  const tier = TIERS[entry.tier];
  if (!tier) return null;
  return { tier, division: DIVISIONS[entry.rank] ?? 1, lp: entry.leaguePoints };
}

interface Profile {
  solo?: RankedQueue;
  flex?: RankedQueue;
}

export interface BundleOptions {
  count: number;
  refresh?: boolean;
  /** Tempo máximo de espera pela coleta (0 = responde na hora). */
  waitMs?: number;
}

export class AccountService {
  constructor(
    private api: RiotApi,
    private repos: Repositories,
    private sync: SyncService,
    private ddragon: DataDragon,
    private logger: Logger,
    private now: () => number = Date.now,
    private sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  async getBundle(region: Region, gameName: string, tagLine: string, options: BundleOptions): Promise<PlayerBundle> {
    validateRiotId(gameName, tagLine);
    const name = gameName.trim();
    const tag = tagLine.trim();

    let account: AccountRow;
    let profile: Profile = {};
    let failure: AppError | null = null;
    try {
      const resolved = await this.resolveAccount(region, name, tag);
      profile = await this.loadProfile(region, resolved.puuid, resolved.gameName, resolved.tagLine, !!options.refresh);
      account = this.repos.getAccount(resolved.puuid)!;
    } catch (e) {
      // Riot fora do ar / limite / chave: se a conta já foi acompanhada, devolve o que está armazenado.
      const stored = e instanceof AppError && SERVE_STORED_ON.has(e.code) ? this.repos.findAccountByRiotId(region, name, tag) : null;
      if (!stored) throw e;
      failure = e as AppError;
      account = stored;
      profile = this.repos.cacheGet<Profile>(`profile:${stored.puuid}`, this.now(), true) ?? {};
      this.logger.warn('conta: servindo dados armazenados', { code: failure.code });
    }

    if (!failure) {
      const done = this.sync.ensure(account.puuid, region, options.count, !!options.refresh);
      const waitMs = options.waitMs ?? SYNC_WAIT_MS;
      if (waitMs > 0) await Promise.race([done, this.sleep(waitMs)]);
    }

    return this.buildBundle(account, profile, options.count, failure);
  }

  /** Account-V1, com cache: Riot ID → PUUID. */
  private async resolveAccount(region: Region, gameName: string, tagLine: string) {
    const key = `account:${region}:${gameName.toLowerCase()}#${tagLine.toLowerCase()}`;
    const cached = this.repos.cacheGet<{ puuid: string; gameName: string; tagLine: string }>(key, this.now());
    if (cached) return cached;
    try {
      const dto = await this.api.accountByRiotId(region, gameName, tagLine);
      const resolved = { puuid: dto.puuid, gameName: dto.gameName ?? gameName, tagLine: dto.tagLine ?? tagLine };
      this.repos.cacheSet(key, resolved, ACCOUNT_TTL_MS, this.now());
      return resolved;
    } catch (e) {
      if (e instanceof RiotNotFoundError) {
        throw new AppError('PLAYER_NOT_FOUND', `Nenhuma conta com o Riot ID ${gameName}#${tagLine} foi encontrada.`);
      }
      throw e;
    }
  }

  /** Summoner-V4 + League-V4 + Champion-Mastery-V4, com cache curto; registra snapshots de elo. */
  private async loadProfile(region: Region, puuid: string, gameName: string, tagLine: string, refresh: boolean): Promise<Profile> {
    const key = `profile:${puuid}`;
    const now = this.now();
    if (!refresh) {
      const cached = this.repos.cacheGet<Profile>(key, now);
      if (cached && this.repos.getAccount(puuid)?.region === region) return cached;
    }

    let summoner;
    try {
      summoner = await this.api.summonerByPuuid(region, puuid);
    } catch (e) {
      if (!(e instanceof RiotNotFoundError)) throw e;
      // A conta existe, mas não tem perfil de LoL nesta plataforma: tenta descobrir a região certa.
      let suggestedRegion: Region | null = null;
      try {
        suggestedRegion = regionFromPlatform((await this.api.activeRegion(region, puuid)).region);
      } catch {
        // Sem sugestão: a mensagem genérica já orienta o usuário.
      }
      throw new AppError(
        'WRONG_REGION',
        suggestedRegion && suggestedRegion !== region
          ? `${gameName}#${tagLine} existe, mas joga na região ${suggestedRegion}. Troque a região e pesquise de novo.`
          : `${gameName}#${tagLine} existe, mas não tem perfil de League of Legends na região ${region}. Confira a região.`,
        suggestedRegion ? { suggestedRegion } : {},
      );
    }

    const entries = await this.api.leagueEntriesByPuuid(region, puuid);
    const queue = (type: string): RankedQueue | undefined => {
      const e = entries.find((x) => x.queueType === type);
      const rank = e ? toRank(e) : null;
      return e && rank ? { rank, wins: e.wins, losses: e.losses, hotStreak: e.hotStreak } : undefined;
    };
    const profile: Profile = { solo: queue('RANKED_SOLO_5x5'), flex: queue('RANKED_FLEX_SR') };

    this.repos.upsertAccount({ puuid, gameName, tagLine, region, summonerLevel: summoner.summonerLevel, profileIconId: summoner.profileIconId }, now);
    this.recordSnapshot(puuid, 'SOLO', profile.solo, now);
    this.recordSnapshot(puuid, 'FLEX', profile.flex, now);

    try {
      const mastery = await this.api.topMasteries(region, puuid, 10);
      this.repos.replaceMastery(
        puuid,
        mastery.map((m) => ({ championId: m.championId, level: m.championLevel, points: m.championPoints, lastPlayTime: m.lastPlayTime })),
        now,
      );
    } catch (e) {
      // Maestria é complementar: mantém a última cópia se a consulta falhar.
      this.logger.warn('conta: maestria indisponível', { code: e instanceof AppError ? e.code : 'erro' });
    }

    this.repos.cacheSet(key, profile, PROFILE_TTL_MS, now);
    return profile;
  }

  /** Grava um snapshot quando o elo mudou ou o último registro é antigo. */
  private recordSnapshot(puuid: string, queue: 'SOLO' | 'FLEX', q: RankedQueue | undefined, now: number): void {
    if (!q) return;
    const last = this.repos.lastSnapshot(puuid, queue);
    const changed =
      !last || last.rank.tier !== q.rank.tier || last.rank.division !== q.rank.division || last.rank.lp !== q.rank.lp || last.wins !== q.wins || last.losses !== q.losses;
    if (changed || now - last.t >= SNAPSHOT_INTERVAL_MS) this.repos.addSnapshot(puuid, queue, q.rank, q.wins, q.losses, now);
  }

  private async buildBundle(account: AccountRow, profile: Profile, count: number, failure: AppError | null): Promise<PlayerBundle> {
    const st = await this.ddragon.get();
    const stored = this.repos.getMatches(this.sync.matchIds(account.puuid, count));
    const ignored = { otherModes: 0, remakes: 0 };
    const matches = [];
    for (const m of stored) {
      const kind = classify(m, account.puuid);
      if (kind === 'otherMode') ignored.otherModes++;
      else if (kind === 'remake') ignored.remakes++;
      else matches.push(toPlayerMatch(m, account.puuid, st)!);
    }

    const player: Player = {
      id: account.puuid,
      puuid: account.puuid,
      gameName: account.gameName,
      tagLine: account.tagLine,
      region: account.region,
      level: account.summonerLevel,
      profileIconId: account.profileIconId,
      rank: profile.solo?.rank ?? null,
      seasonHistory: [],
      ranked: { solo: profile.solo, flex: profile.flex },
    };

    const sync = this.sync.status(account.puuid, count);
    const itemNames: Record<string, string> = {};
    if (st) for (const m of matches) for (const id of [...m.items, m.trinket]) if (st.items[id]) itemNames[id] = st.items[id].name;

    return {
      player,
      matches,
      asOf: this.now(),
      source: 'riot',
      rankHistory: this.repos.snapshots(account.puuid),
      mastery: this.mastery(account.puuid, st),
      champions: st ? Object.values(st.champions) : fallbackChampions(stored),
      itemNames,
      ddragonVersion: st?.version,
      ignored,
      sync: failure
        ? { ...sync, state: 'error', errorCode: failure.code, message: failure.message, retryAfterSec: failure.details.retryAfterSec as number | undefined }
        : sync,
    };
  }

  /**
   * Dados já armazenados de uma conta (perfil, partidas, snapshots), sem consultar a Riot.
   * Usado pelo treinador, que roda sobre o que já foi coletado.
   */
  async getStoredBundle(puuid: string, count: number): Promise<PlayerBundle> {
    const account = this.repos.getAccount(puuid);
    if (!account) throw new AppError('PLAYER_NOT_FOUND', 'Conta ainda não acompanhada. Pesquise o jogador antes de abrir o treinador.');
    const profile = this.repos.cacheGet<Profile>(`profile:${puuid}`, this.now(), true) ?? {};
    return this.buildBundle(account, profile, count, null);
  }

  private mastery(puuid: string, st: StaticData | null): MasteryEntry[] {
    if (!st) return [];
    return this.repos
      .mastery(puuid)
      .filter((m) => st.champions[m.championId])
      .map((m) => ({ championId: st.champions[m.championId].id, level: m.level, points: m.points, lastPlayed: m.lastPlayTime }));
  }

  /** Ordem de habilidades, itens e linha do tempo de uma partida (Match-V5 timeline), sob demanda e com cache. */
  async getMatchDetails(matchId: string, puuid: string): Promise<MatchDetails> {
    const region = regionFromMatchId(matchId);
    const match = this.repos.getMatch(matchId);
    if (!region || !match || !match.participants.some((p) => p.puuid === puuid)) {
      throw new AppError('MATCH_NOT_FOUND', 'Partida não encontrada para esta conta.');
    }
    const key = `${matchId}:${puuid}`;
    const cached = this.repos.getTimeline<MatchDetails>(key);
    if (cached) return cached;
    try {
      const st = await this.ddragon.get();
      const details = toMatchDetails(await this.api.timeline(region, matchId), match, puuid, st);
      this.repos.saveTimeline(key, details, this.now());
      return details;
    } catch (e) {
      if (e instanceof RiotNotFoundError) throw new AppError('MATCH_NOT_FOUND', 'A Riot não disponibiliza mais a linha do tempo desta partida.');
      throw e;
    }
  }
}

/** Sem Data Dragon, monta um catálogo mínimo com os nomes vindos das próprias partidas. */
function fallbackChampions(stored: Array<{ participants: Array<{ championName: string }> }>): Champion[] {
  const names = new Set(stored.flatMap((m) => m.participants.map((p) => p.championName)));
  return [...names].map((id) => ({ id, name: id, title: '', classes: [], color: '#3A4658' }));
}
