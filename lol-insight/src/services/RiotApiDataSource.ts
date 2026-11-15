import type { PlayerBundle } from '@/types';

import type { AccountQuery, AccountSuggestion, PlayerDataSource } from './PlayerDataSource';

/**
 * Integração futura com dados reais da Riot Games.
 *
 * IMPORTANTE — a chave da Riot API nunca deve ser embutida no aplicativo.
 * Este cliente conversa com um backend próprio (proxy), que:
 *   1. guarda a API key em variável de ambiente do servidor;
 *   2. consulta Account-V1, League-V4 e Match-V5 respeitando os rate limits;
 *   3. normaliza a resposta para o formato `PlayerBundle` (src/types).
 *
 * Para ativar: defina EXPO_PUBLIC_API_BASE_URL (URL do proxy, não é segredo)
 * e EXPO_PUBLIC_DATA_SOURCE=riot. Ver src/services/index.ts.
 */
export class RiotApiDataSource implements PlayerDataSource {
  constructor(private baseUrl: string) {}

  async loadAccount(query: AccountQuery): Promise<PlayerBundle | null> {
    const riotId = encodeURIComponent(`${query.gameName}#${query.tagLine ?? query.region}`);
    const res = await fetch(`${this.baseUrl}/v1/accounts/${query.region}/${riotId}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Falha ao consultar a conta (HTTP ${res.status})`);
    return (await res.json()) as PlayerBundle;
  }

  async suggestions(): Promise<AccountSuggestion[]> {
    return [];
  }
}
