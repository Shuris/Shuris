import type { Region } from '../../../src/types/index.ts';
import { accountHost, matchHost, platformHost } from '../regions.ts';
import type { RequestOptions, RiotClient } from './client.ts';
import type { AccountDto, ActiveRegionDto, ChampionMasteryDto, LeagueEntryDto, MatchDto, SummonerDto, TimelineDto } from './types.ts';

const enc = encodeURIComponent;

/**
 * Endpoints da Riot usados pelo app, com o roteamento correto de cada um:
 * Account-V1 e Match-V5 → cluster regional; os demais → plataforma.
 */
export class RiotApi {
  constructor(private client: RiotClient) {}

  /** Account-V1 — conta pelo Riot ID. */
  accountByRiotId(region: Region, gameName: string, tagLine: string, opts?: RequestOptions) {
    return this.client.get<AccountDto>(accountHost(region), `/riot/account/v1/accounts/by-riot-id/${enc(gameName)}/${enc(tagLine)}`, opts);
  }

  /** Account-V1 — plataforma em que a conta joga LoL (para sugerir a região certa). */
  activeRegion(region: Region, puuid: string, opts?: RequestOptions) {
    return this.client.get<ActiveRegionDto>(accountHost(region), `/riot/account/v1/region/by-game/lol/by-puuid/${enc(puuid)}`, opts);
  }

  /** Summoner-V4 — nível e ícone de perfil. */
  summonerByPuuid(region: Region, puuid: string, opts?: RequestOptions) {
    return this.client.get<SummonerDto>(platformHost(region), `/lol/summoner/v4/summoners/by-puuid/${enc(puuid)}`, opts);
  }

  /** League-V4 — filas ranqueadas (elo, LP, vitórias e derrotas). */
  leagueEntriesByPuuid(region: Region, puuid: string, opts?: RequestOptions) {
    return this.client.get<LeagueEntryDto[]>(platformHost(region), `/lol/league/v4/entries/by-puuid/${enc(puuid)}`, opts);
  }

  /** Champion-Mastery-V4 — campeões com maior maestria. */
  topMasteries(region: Region, puuid: string, count: number, opts?: RequestOptions) {
    return this.client.get<ChampionMasteryDto[]>(platformHost(region), `/lol/champion-mastery/v4/champion-masteries/by-puuid/${enc(puuid)}/top`, {
      ...opts,
      query: { count },
    });
  }

  /** Match-V5 — IDs das partidas mais recentes (máx. 100 por chamada). */
  matchIds(region: Region, puuid: string, start: number, count: number, opts?: RequestOptions) {
    return this.client.get<string[]>(matchHost(region), `/lol/match/v5/matches/by-puuid/${enc(puuid)}/ids`, { ...opts, query: { start, count } });
  }

  /** Match-V5 — detalhes de uma partida. */
  match(region: Region, matchId: string, opts?: RequestOptions) {
    return this.client.get<MatchDto>(matchHost(region), `/lol/match/v5/matches/${enc(matchId)}`, opts);
  }

  /** Match-V5 — linha do tempo de uma partida. */
  timeline(region: Region, matchId: string, opts?: RequestOptions) {
    return this.client.get<TimelineDto>(matchHost(region), `/lol/match/v5/matches/${enc(matchId)}/timeline`, opts);
  }
}
