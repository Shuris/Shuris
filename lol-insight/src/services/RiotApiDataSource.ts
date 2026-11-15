import type { DataSourceKind, Match, MatchDetails, Player, PlayerBundle } from '@/types';

import { ServiceError } from './errors';
import { requestJson } from './http';
import type { AccountQuery, AccountSuggestion, LoadOptions, PlayerDataSource } from './PlayerDataSource';

export interface ServerHealth {
  ok: boolean;
  riotApiKeyConfigured: boolean;
}

/**
 * Modo real: conversa com o backend do LOL Insight (pasta server/), que é quem
 * guarda a chave da Riot e consulta Account-V1, Summoner-V4, League-V4,
 * Match-V5 e Champion-Mastery-V4. O app nunca fala com a Riot diretamente e
 * nunca tem acesso à chave.
 */
export class RiotApiDataSource implements PlayerDataSource {
  readonly kind: DataSourceKind = 'riot';
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async loadAccount(query: AccountQuery, options: LoadOptions = {}): Promise<PlayerBundle> {
    const name = query.gameName.trim();
    const tag = query.tagLine?.trim() ?? '';
    // Validação local: evita uma ida ao servidor para erros óbvios de digitação.
    if (!name) throw new ServiceError('INVALID_RIOT_ID', 'Digite o Riot ID do jogador.');
    if (!tag) throw new ServiceError('INVALID_RIOT_ID', 'Falta a tag do Riot ID. Digite no formato Nome#TAG (ex.: Gregory#BR1).');
    if (name.length < 3 || name.length > 16) throw new ServiceError('INVALID_RIOT_ID', 'O nome do Riot ID deve ter de 3 a 16 caracteres.');
    if (!/^[\p{L}\p{N}]{3,5}$/u.test(tag)) throw new ServiceError('INVALID_RIOT_ID', 'A tag do Riot ID deve ter de 3 a 5 letras ou números.');

    const params = `count=${options.count ?? 20}${options.refresh ? '&refresh=1' : ''}`;
    return this.request<PlayerBundle>(`/v1/accounts/${query.region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?${params}`);
  }

  async loadMatchDetails(match: Match, player: Player): Promise<MatchDetails> {
    return this.request<MatchDetails>(`/v1/matches/${encodeURIComponent(match.id)}/details?puuid=${encodeURIComponent(player.puuid ?? player.id)}`);
  }

  async suggestions(): Promise<AccountSuggestion[]> {
    return [];
  }

  async health(): Promise<ServerHealth> {
    return this.request<ServerHealth>('/health', 6000);
  }

  private request<T>(path: string, timeoutMs?: number): Promise<T> {
    return requestJson<T>(this.baseUrl, path, { timeoutMs });
  }
}
