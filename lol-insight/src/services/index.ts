import { MockDataSource } from './MockDataSource';
import type { PlayerDataSource } from './PlayerDataSource';
import { RiotApiDataSource } from './RiotApiDataSource';

export * from './PlayerDataSource';

/**
 * Ponto único de escolha da fonte de dados.
 * Padrão: dados demonstrativos locais. Com EXPO_PUBLIC_DATA_SOURCE=riot e
 * EXPO_PUBLIC_API_BASE_URL definidos, o app passa a consumir o backend/proxy.
 */
function createDataSource(): PlayerDataSource {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (process.env.EXPO_PUBLIC_DATA_SOURCE === 'riot' && baseUrl) return new RiotApiDataSource(baseUrl);
  return new MockDataSource();
}

export const dataSource: PlayerDataSource = createDataSource();
