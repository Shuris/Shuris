/** DTOs da Riot Games API — apenas os campos que o LOL Insight utiliza. */

export interface AccountDto {
  puuid: string;
  gameName?: string;
  tagLine?: string;
}

export interface ActiveRegionDto {
  puuid: string;
  game: string;
  region: string;
}

export interface SummonerDto {
  puuid: string;
  profileIconId: number;
  summonerLevel: number;
  revisionDate?: number;
}

export interface LeagueEntryDto {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak?: boolean;
}

export interface ChampionMasteryDto {
  championId: number;
  championLevel: number;
  championPoints: number;
  lastPlayTime: number;
}

export interface PerkStyleDto {
  description: string;
  style: number;
  selections: Array<{ perk: number }>;
}

export interface ParticipantDto {
  puuid: string;
  participantId: number;
  riotIdGameName?: string;
  riotIdTagline?: string;
  summonerName?: string;
  championId: number;
  championName: string;
  champLevel: number;
  teamId: number;
  teamPosition?: string;
  individualPosition?: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  goldEarned: number;
  totalDamageDealtToChampions: number;
  totalDamageTaken: number;
  visionScore: number;
  firstBloodKill?: boolean;
  firstBloodAssist?: boolean;
  gameEndedInEarlySurrender?: boolean;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  summoner1Id: number;
  summoner2Id: number;
  perks?: {
    statPerks?: { defense: number; flex: number; offense: number };
    styles?: PerkStyleDto[];
  };
  challenges?: {
    dragonTakedowns?: number;
    baronTakedowns?: number;
    riftHeraldTakedowns?: number;
  };
}

export interface ObjectiveDto {
  first?: boolean;
  kills: number;
}

export interface TeamDto {
  teamId: number;
  win: boolean;
  objectives?: {
    baron?: ObjectiveDto;
    champion?: ObjectiveDto;
    dragon?: ObjectiveDto;
    riftHerald?: ObjectiveDto;
    tower?: ObjectiveDto;
  };
}

export interface MatchDto {
  metadata: { matchId: string; participants: string[] };
  info: {
    gameCreation: number;
    gameStartTimestamp?: number;
    gameEndTimestamp?: number;
    gameDuration: number;
    gameVersion?: string;
    queueId: number;
    participants: ParticipantDto[];
    teams: TeamDto[];
  };
}

export interface TimelineEventDto {
  type: string;
  timestamp: number;
  participantId?: number;
  skillSlot?: number;
  levelUpType?: string;
  killerId?: number;
  victimId?: number;
  assistingParticipantIds?: number[];
  monsterType?: string;
  monsterSubType?: string;
  killerTeamId?: number;
  buildingType?: string;
  towerType?: string;
  teamId?: number;
  itemId?: number;
  winningTeam?: number;
}

export interface TimelineDto {
  metadata: { matchId: string; participants: string[] };
  info: {
    participants?: Array<{ participantId: number; puuid: string }>;
    frames: Array<{ timestamp: number; events: TimelineEventDto[] }>;
  };
}
