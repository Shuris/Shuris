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
  | 'MESTRE'
  | 'GRAO_MESTRE'
  | 'DESAFIANTE';
/** Classes de campeão, iguais às "tags" do Data Dragon. */
export type ChampionClass = 'MAGE' | 'ASSASSIN' | 'MARKSMAN' | 'FIGHTER' | 'TANK' | 'SUPPORT';
/** Origem dos dados: conta demonstrativa (fictícia) ou Riot Games API. */
export type DataSourceKind = 'demo' | 'riot';

export interface Rank {
  tier: Tier;
  /** 1 (I) a 4 (IV). Mestre, Grão-Mestre e Desafiante não possuem divisão. */
  division: 1 | 2 | 3 | 4;
  lp: number;
}

export interface Champion {
  /** Chave usada pelo Data Dragon (ex.: "LeeSin"). */
  id: string;
  name: string;
  title: string;
  classes: ChampionClass[];
  /** Posições típicas (usado apenas pelo gerador demonstrativo). */
  positions?: Position[];
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
  /** Elo Solo/Duo atual; `null` quando a conta não está ranqueada. */
  rank: Rank | null;
  /** Histórico de fim de temporada. A Riot API não fornece: só existe no modo demonstração. */
  seasonHistory: SeasonRank[];
  puuid?: string;
  /** Totais da temporada informados pelo League-V4. */
  ranked?: { solo?: RankedQueue; flex?: RankedQueue };
}

export interface RankedQueue {
  rank: Rank;
  wins: number;
  losses: number;
  hotStreak?: boolean;
}

/** Elo observado em um instante (a Riot não fornece histórico de LP; o backend registra a cada consulta). */
export interface RankSnapshot {
  t: number;
  queue: 'SOLO' | 'FLEX';
  rank: Rank;
  wins: number;
  losses: number;
}

export interface MasteryEntry {
  championId: string;
  level: number;
  points: number;
  lastPlayed: number;
}

export interface RuneSetup {
  keystone: string;
  primaryTree: string;
  primary: string[];
  secondaryTree: string;
  secondary: string[];
  shards: string[];
  /** Caminho do ícone no Data Dragon por nome de runa/árvore (dados reais). */
  icons?: Record<string, string>;
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
  tagLine?: string;
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
  /** Objetivos (dragões + barões + arautos) em que o jogador participou, quando informado. */
  playerParticipations?: number;
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
  /** Feitiços de invocador (dados reais). */
  summonerSpells?: Array<{ name: string; icon: string }>;
  /** false enquanto ordem de habilidades e linha do tempo ainda não foram carregadas (dados reais, sob demanda). */
  detailsLoaded?: boolean;
  /** true quando `items` está na ordem de compra (senão é a ordem dos espaços do inventário). */
  itemsInPurchaseOrder?: boolean;
  /** Dados da linha do tempo para o relatório pós-partida (carregados com os detalhes). */
  analysis?: MatchAnalysis;
}

/** Ponto no mapa, normalizado de 0 a 1. Origem no canto inferior esquerdo (base da equipe azul). */
export interface MapPoint {
  x: number;
  y: number;
}

export interface AnalysisDeath extends MapPoint {
  /** Minuto (com fração) da morte. */
  minute: number;
  killerChampionId?: string;
  /** Inimigos que participaram do abate (abatedor + assistências). */
  enemiesInvolved: number;
}

/** Dados minuto a minuto usados pelo relatório pós-partida (Match-V5 timeline). */
export interface MatchAnalysis {
  /** Diferenças para o oponente direto de rota (índice = minuto). */
  frames: Array<{ minute: number; goldDiff: number; csDiff: number; xpDiff: number; cs: number }>;
  deaths: AnalysisDeath[];
  kills: Array<MapPoint & { minute: number }>;
  /** Minuto de cada sentinela colocada / destruída pelo jogador. */
  wardsPlaced: number[];
  wardsKilled: number[];
  playerTeam: 'BLUE' | 'RED';
}

/** Detalhes carregados sob demanda ao abrir uma partida real. */
export interface MatchDetails {
  skillOrder: Array<'Q' | 'W' | 'E' | 'R'>;
  timeline: TimelineEvent[];
  /** Itens concluídos, em ordem de compra. */
  itemOrder: number[];
  /** Ausente em detalhes antigos em cache (antes do relatório pós-partida). */
  analysis?: MatchAnalysis;
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'waiting_rate_limit' | 'error';
  /** Quantidade de partidas solicitada (10, 20, 50 ou 100). */
  requested: number;
  /** Partidas existentes no histórico recente (até `requested`). */
  available: number;
  /** Partidas já baixadas e armazenadas. */
  loaded: number;
  retryAfterSec?: number;
  errorCode?: string;
  message?: string;
  lastSyncedAt?: number;
}

export interface PlayerBundle {
  player: Player;
  matches: Match[];
  /** Instante de referência dos dados ("agora" para os filtros de período). */
  asOf: number;
  source: DataSourceKind;
  /** Snapshots de elo registrados pelo backend (dados reais). */
  rankHistory?: RankSnapshot[];
  mastery?: MasteryEntry[];
  /** Catálogo de campeões do Data Dragon (dados reais). */
  champions?: Champion[];
  itemNames?: Record<string, string>;
  ddragonVersion?: string;
  sync?: SyncStatus;
  /** Partidas recentes que não entram na análise. */
  ignored?: { otherModes: number; remakes: number };
}
