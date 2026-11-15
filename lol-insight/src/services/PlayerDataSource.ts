import type { PlayerBundle, Region } from '@/types';

export interface AccountQuery {
  gameName: string;
  /** Opcional: quando omitida, a fonte de dados pode resolver pela região. */
  tagLine?: string;
  region: Region;
}

export interface AccountSuggestion {
  gameName: string;
  tagLine: string;
  region: Region;
}

/**
 * Contrato único entre o app e a origem dos dados.
 *
 * As telas e a lógica estatística dependem apenas desta interface. Para usar
 * dados reais basta fornecer outra implementação (ver RiotApiDataSource) —
 * nenhuma tela precisa mudar.
 */
export interface PlayerDataSource {
  /** Devolve a conta e seu histórico, ou `null` quando o invocador não existe na região. */
  loadAccount(query: AccountQuery): Promise<PlayerBundle | null>;
  /** Contas sugeridas para a busca (ex.: contas demonstrativas). */
  suggestions(): Promise<AccountSuggestion[]>;
}

/** Interpreta "Nome#TAG" digitado pelo usuário. */
export function parseRiotId(input: string): { gameName: string; tagLine?: string } {
  const [name, tag] = input.split('#');
  return { gameName: name.trim(), tagLine: tag?.trim() || undefined };
}
