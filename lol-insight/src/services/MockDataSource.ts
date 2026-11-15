import { mockBundles } from '@/data/mock/players';
import type { PlayerBundle } from '@/types';

import type { AccountQuery, AccountSuggestion, PlayerDataSource } from './PlayerDataSource';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const norm = (s: string) => s.trim().toLocaleLowerCase('pt-BR');

/** Fonte de dados local com as contas demonstrativas. Simula a latência de rede. */
export class MockDataSource implements PlayerDataSource {
  constructor(private latencyMs = 650) {}

  async loadAccount(query: AccountQuery): Promise<PlayerBundle | null> {
    await wait(this.latencyMs);
    return (
      mockBundles().find(
        (b) =>
          b.player.region === query.region &&
          norm(b.player.gameName) === norm(query.gameName) &&
          (!query.tagLine || norm(b.player.tagLine) === norm(query.tagLine)),
      ) ?? null
    );
  }

  async suggestions(): Promise<AccountSuggestion[]> {
    return mockBundles().map(({ player }) => ({
      gameName: player.gameName,
      tagLine: player.tagLine,
      region: player.region,
    }));
  }
}
