/** Modelos de domínio. Espelham o que a Riot API (Account/League/Match-V5) fornece, já normalizado. */

export type Region = 'BR' | 'NA' | 'EUW' | 'EUNE' | 'KR' | 'LAN' | 'LAS' | 'JP' | 'OCE' | 'TR';
export type Position = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT';
export type QueueType = 'SOLO' | 'FLEX' | 'NORMAL';
export type Tier =
  | 'FERRO'
  | 'BRONZE'
  | 'PRATA'
  | 'OURO'
  | 'PLATINA'
  | 'ESMERALDA'
  | 'DIAMANTE'
  | 'MESTRE';
export type ChampionClass = 'CONTROLE' | 'EXPLOSAO' | 'INICIACAO' | 'ATIRADOR' | 'LUTADOR';

export interface Rank {
  tier: Tier;
  /** 1 (I) a 4 (IV). Mestre não possui divisão. */
  division: 1 | 2 | 3 | 4;
  lp: number;
}

export interface Champion {
  /** Chave usada pelo Data Dragon (ex.: "LeeSin"). */
  id: string;
  name: string;
  title: string;
  classes: ChampionClass[];
  positions: Position[];
  /** Cor usada no avatar de fallback quando a imagem oficial não carrega. */
  color: string;
}

export interface SeasonRank {
  season: string;
  rank: Rank;
}

export interface Player {
  id: string;
  gameName: string;
  tagLine: string;
  region: Region;
  level: number;
  profileIconId: number;
  rank: Rank;
  /** Histórico de fim de temporada (anteriores à atual). */
  seasonHistory: SeasonRank[];
}

export interface RuneSetup {
  keystone: string;
  primaryTree: string;
  primary: string[];
  secondaryTree: string;
  secondary: string[];
  shards: string[];
}

export interface Participant {
  name: string;
  championId: string;
  team: 'BLUE' | 'RED';
  position: Position;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  damage: number;
  isPlayer: boolean;
}

export type TimelineKind = 'KILL' | 'DEATH' | 'ASSIST' | 'DRAGON' | 'BARON' | 'HERALD' | 'TOWER' | 'ITEM' | 'END';

export interface TimelineEvent {
  minute: number;
  kind: TimelineKind;
  text: string;
  /** true quando o evento favorece o time do jogador. */
  positive: boolean;
}

export interface Objectives {
  dragons: number;
  barons: number;
  heralds: number;
  towers: number;
  /** Objetivos (dragões + barões + arautos) em que o jogador participou. */
  playerParticipations: number;
  enemyDragons: number;
  enemyBarons: number;
  enemyTowers: number;
}

export interface Match {
  id: string;
  /** Epoch ms do início da partida. */
  timestamp: number;
  durationSec: number;
  queue: QueueType;
  win: boolean;
  championId: string;
  position: Position;
  opponentChampionId: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  damageDealt: number;
  damageTaken: number;
  visionScore: number;
  teamKills: number;
  firstBlood: boolean;
  /** Elo imediatamente após a partida (apenas Solo/Duo). */
  rankAfter?: Rank;
  lpDelta?: number;
  items: number[];
  trinket: number;
  runes: RuneSetup;
  /** Habilidade evoluída em cada nível (índice 0 = nível 1). */
  skillOrder: Array<'Q' | 'W' | 'E' | 'R'>;
  participants: Participant[];
  objectives: Objectives;
  timeline: TimelineEvent[];
}

export interface PlayerBundle {
  player: Player;
  matches: Match[];
  /** Instante de referência dos dados ("agora" para os filtros de período). */
  asOf: number;
}
