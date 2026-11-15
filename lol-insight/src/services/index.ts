import type { DataSourceKind } from '@/types';

import { MockDataSource } from './MockDataSource';
import type { PlayerDataSource } from './PlayerDataSource';
import { RiotApiDataSource } from './RiotApiDataSource';

export * from './errors';
export * from './PlayerDataSource';
export { RiotApiDataSource } from './RiotApiDataSource';

const mock = new MockDataSource();

/**
 * Ponto único de escolha da fonte de dados, conforme o modo ativo:
 * - "demo": contas fictícias locais;
 * - "riot": backend do LOL Insight, que consulta a Riot Games API.
 */
export function createDataSource(mode: DataSourceKind, serverUrl: string): PlayerDataSource {
  return mode === 'riot' ? new RiotApiDataSource(serverUrl) : mock;
}
