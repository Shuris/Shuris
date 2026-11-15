import type { DataSourceKind, Match, MatchDetails, Player, PlayerBundle, Region } from '@/types';

export interface AccountQuery {
  gameName: string;
  /** Obrigatória para dados reais; opcional na demonstração. */
  tagLine?: string;
  region: Region;
}

export interface AccountSuggestion {
  gameName: string;
  tagLine: string;
  region: Region;
}

export interface LoadOptions {
  /** Quantidade de partidas recentes a analisar (dados reais): 10, 20, 50 ou 100. */
  count?: number;
  /** Ignora os caches e consulta a Riot de novo. */
  refresh?: boolean;
}

export const MATCH_COUNTS = [10, 20, 50, 100] as const;
export type MatchCount = (typeof MATCH_COUNTS)[number];

/**
 * Contrato único entre o app e a origem dos dados. As telas e a lógica
 * estatística dependem apenas desta interface; há duas implementações:
 * MockDataSource (demonstração) e RiotApiDataSource (backend + Riot API).
 * Falhas são sempre lançadas como ServiceError (ver errors.ts).
 */
export interface PlayerDataSource {
  readonly kind: DataSourceKind;
  loadAccount(query: AccountQuery, options?: LoadOptions): Promise<PlayerBundle>;
  /** Ordem de habilidades, itens e linha do tempo de uma partida (sob demanda nos dados reais). */
  loadMatchDetails(match: Match, player: Player): Promise<MatchDetails>;
  /** Contas sugeridas para a busca (contas demonstrativas). */
  suggestions(): Promise<AccountSuggestion[]>;
}

/** Interpreta "Nome#TAG" digitado pelo usuário. */
export function parseRiotId(input: string): { gameName: string; tagLine?: string } {
  const [name, tag] = input.split('#');
  return { gameName: name.trim(), tagLine: tag?.trim() || undefined };
}
