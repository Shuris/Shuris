import { demoAnalysis } from '@/data/mock/analysis';
import { mockBundles } from '@/data/mock/players';
import type { DataSourceKind, Match, MatchDetails, PlayerBundle } from '@/types';

import { ServiceError } from './errors';
import type { AccountQuery, AccountSuggestion, PlayerDataSource } from './PlayerDataSource';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const norm = (s: string) => s.trim().toLocaleLowerCase('pt-BR');

/** Modo demonstração: contas fictícias geradas localmente. Simula a latência de rede. */
export class MockDataSource implements PlayerDataSource {
  readonly kind: DataSourceKind = 'demo';

  constructor(private latencyMs = 650) {}

  async loadAccount(query: AccountQuery): Promise<PlayerBundle> {
    await wait(this.latencyMs);
    const found = mockBundles().find(
      (b) =>
        b.player.region === query.region &&
        norm(b.player.gameName) === norm(query.gameName) &&
        (!query.tagLine || norm(b.player.tagLine) === norm(query.tagLine)),
    );
    if (!found) {
      throw new ServiceError(
        'PLAYER_NOT_FOUND',
        `"${query.gameName}${query.tagLine ? `#${query.tagLine}` : ''}" não existe entre as contas demonstrativas da região ${query.region}.`,
      );
    }
    return found;
  }

  async loadMatchDetails(match: Match): Promise<MatchDetails> {
    return { skillOrder: match.skillOrder, timeline: match.timeline, itemOrder: match.items, analysis: demoAnalysis(match) };
  }

  async suggestions(): Promise<AccountSuggestion[]> {
    return mockBundles().map(({ player }) => ({ gameName: player.gameName, tagLine: player.tagLine, region: player.region }));
  }
}
