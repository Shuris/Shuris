import type { Region } from '../../src/types/index.ts';

/**
 * A Riot usa dois níveis de roteamento:
 *  - PLATAFORMA (br1, na1, euw1...): Summoner-V4, League-V4, Champion-Mastery-V4.
 *  - CLUSTER REGIONAL (americas, europe, asia, sea): Account-V1 e Match-V5.
 */
export type Platform = 'br1' | 'na1' | 'la1' | 'la2' | 'euw1' | 'eun1' | 'tr1' | 'kr' | 'jp1' | 'oc1';
export type RegionalCluster = 'americas' | 'europe' | 'asia' | 'sea';

interface RegionInfo {
  platform: Platform;
  /** Cluster usado pelo Match-V5. */
  matchCluster: RegionalCluster;
  /** Cluster usado pelo Account-V1 (não existe em "sea"; usa-se o mais próximo). */
  accountCluster: Exclude<RegionalCluster, 'sea'>;
}

const REGIONS: Record<Region, RegionInfo> = {
  BR: { platform: 'br1', matchCluster: 'americas', accountCluster: 'americas' },
  NA: { platform: 'na1', matchCluster: 'americas', accountCluster: 'americas' },
  LAN: { platform: 'la1', matchCluster: 'americas', accountCluster: 'americas' },
  LAS: { platform: 'la2', matchCluster: 'americas', accountCluster: 'americas' },
  EUW: { platform: 'euw1', matchCluster: 'europe', accountCluster: 'europe' },
  EUNE: { platform: 'eun1', matchCluster: 'europe', accountCluster: 'europe' },
  TR: { platform: 'tr1', matchCluster: 'europe', accountCluster: 'europe' },
  KR: { platform: 'kr', matchCluster: 'asia', accountCluster: 'asia' },
  JP: { platform: 'jp1', matchCluster: 'asia', accountCluster: 'asia' },
  OCE: { platform: 'oc1', matchCluster: 'sea', accountCluster: 'asia' },
};

export const REGION_CODES = Object.keys(REGIONS) as Region[];

export function isRegion(value: string): value is Region {
  return Object.hasOwn(REGIONS, value);
}

export function regionInfo(region: Region): RegionInfo {
  return REGIONS[region];
}

export const platformHost = (region: Region) => `${REGIONS[region].platform}.api.riotgames.com`;
export const matchHost = (region: Region) => `${REGIONS[region].matchCluster}.api.riotgames.com`;
export const accountHost = (region: Region) => `${REGIONS[region].accountCluster}.api.riotgames.com`;

/** "br1" → "BR" (usado para sugerir a região correta de uma conta). */
export function regionFromPlatform(platform: string): Region | null {
  const found = REGION_CODES.find((r) => REGIONS[r].platform === platform.toLowerCase());
  return found ?? null;
}

/** O prefixo do ID da partida identifica a plataforma: "BR1_3104..." → "BR". */
export function regionFromMatchId(matchId: string): Region | null {
  return regionFromPlatform(matchId.split('_')[0] ?? '');
}
