import type { AnalysisDeath, Match, MatchAnalysis, MatchDetails, Participant, Position, QueueType, RuneSetup, TimelineEvent } from '../../../src/types/index.ts';
import type { StaticData } from '../ddragon.ts';
import type { MatchDto, ParticipantDto, TimelineDto } from '../riot/types.ts';

/** Partida reduzida aos campos úteis, como fica armazenada no banco. */
export interface StoredParticipant {
  puuid: string;
  participantId: number;
  name: string;
  tagLine: string;
  championId: number;
  championName: string;
  teamId: number;
  position: Position | '';
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  damage: number;
  damageTaken: number;
  vision: number;
  firstBlood: boolean;
  items: number[];
  trinket: number;
  spells: number[];
  level: number;
  perks: { primaryStyle: number; primary: number[]; subStyle: number; secondary: number[]; shards: number[] };
  /** Dragões + barões + arautos com participação do jogador (quando a Riot informa). */
  objectiveTakedowns: number | null;
}

export interface StoredTeam {
  win: boolean;
  kills: number;
  dragons: number;
  barons: number;
  heralds: number;
  towers: number;
}

export interface StoredMatch {
  matchId: string;
  queueId: number;
  gameCreation: number;
  durationSec: number;
  gameVersion: string;
  remake: boolean;
  participants: StoredParticipant[];
  teams: Record<string, StoredTeam>;
}

/** Filas de Summoner's Rift 5v5 analisadas pelo app. */
const QUEUES: Record<number, QueueType> = {
  420: 'SOLO',
  440: 'FLEX',
  400: 'NORMAL', // Escolha Alternada
  430: 'NORMAL', // Escolha às Cegas
  480: 'NORMAL', // Swiftplay
  490: 'NORMAL', // Partida Rápida
};

const POSITIONS: Record<string, Position> = { TOP: 'TOP', JUNGLE: 'JUNGLE', MIDDLE: 'MID', MID: 'MID', BOTTOM: 'ADC', UTILITY: 'SUPPORT' };

const SHARDS: Record<number, string> = {
  5001: 'Vida Escalável',
  5002: 'Armadura',
  5003: 'Resistência Mágica',
  5005: 'Velocidade de Ataque',
  5007: 'Aceleração de Habilidade',
  5008: 'Força Adaptativa',
  5010: 'Velocidade de Movimento',
  5011: 'Vida',
  5013: 'Tenacidade e Resistência a Lentidão',
};

const REMAKE_MAX_SEC = 300;

function position(p: ParticipantDto): Position | '' {
  return POSITIONS[p.teamPosition ?? ''] ?? POSITIONS[p.individualPosition ?? ''] ?? '';
}

export function toStoredMatch(dto: MatchDto): StoredMatch {
  const info = dto.info;
  // Partidas antigas (sem gameEndTimestamp) informam a duração em milissegundos.
  const durationSec = info.gameEndTimestamp ? info.gameDuration : Math.round(info.gameDuration / 1000);
  const participants: StoredParticipant[] = info.participants.map((p) => {
    const styles = p.perks?.styles ?? [];
    const primary = styles.find((s) => s.description === 'primaryStyle') ?? styles[0];
    const sub = styles.find((s) => s.description === 'subStyle') ?? styles[1];
    const stat = p.perks?.statPerks;
    const ch = p.challenges;
    const takedowns = ch && (ch.dragonTakedowns ?? ch.baronTakedowns ?? ch.riftHeraldTakedowns) !== undefined;
    return {
      puuid: p.puuid,
      participantId: p.participantId,
      name: p.riotIdGameName || p.summonerName || 'Jogador',
      tagLine: p.riotIdTagline ?? '',
      championId: p.championId,
      championName: p.championName,
      teamId: p.teamId,
      position: position(p),
      win: p.win,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      cs: (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0),
      gold: p.goldEarned,
      damage: p.totalDamageDealtToChampions,
      damageTaken: p.totalDamageTaken,
      vision: p.visionScore,
      firstBlood: !!(p.firstBloodKill || p.firstBloodAssist),
      items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].filter((id) => id > 0),
      trinket: p.item6 ?? 0,
      spells: [p.summoner1Id, p.summoner2Id],
      level: p.champLevel,
      perks: {
        primaryStyle: primary?.style ?? 0,
        primary: primary?.selections.map((s) => s.perk) ?? [],
        subStyle: sub?.style ?? 0,
        secondary: sub?.selections.map((s) => s.perk) ?? [],
        shards: stat ? [stat.offense, stat.flex, stat.defense] : [],
      },
      objectiveTakedowns: takedowns ? (ch!.dragonTakedowns ?? 0) + (ch!.baronTakedowns ?? 0) + (ch!.riftHeraldTakedowns ?? 0) : null,
    };
  });

  const teams: Record<string, StoredTeam> = {};
  for (const t of info.teams) {
    const o = t.objectives;
    teams[t.teamId] = {
      win: t.win,
      kills: o?.champion?.kills ?? participants.filter((p) => p.teamId === t.teamId).reduce((s, p) => s + p.kills, 0),
      dragons: o?.dragon?.kills ?? 0,
      barons: o?.baron?.kills ?? 0,
      heralds: o?.riftHerald?.kills ?? 0,
      towers: o?.tower?.kills ?? 0,
    };
  }

  return {
    matchId: dto.metadata.matchId,
    queueId: info.queueId,
    gameCreation: info.gameStartTimestamp ?? info.gameCreation,
    durationSec,
    gameVersion: info.gameVersion ?? '',
    remake: durationSec < REMAKE_MAX_SEC || info.participants.some((p) => p.gameEndedInEarlySurrender),
    participants,
    teams,
  };
}

export type MatchClass = 'analysed' | 'otherMode' | 'remake';

/** Só partidas de Summoner's Rift 5v5 concluídas entram nas estatísticas. */
export function classify(m: StoredMatch, puuid: string): MatchClass {
  const me = m.participants.find((p) => p.puuid === puuid);
  if (!QUEUES[m.queueId] || !me || !me.position || m.participants.length !== 10) return 'otherMode';
  if (m.remake) return 'remake';
  return 'analysed';
}

const championKey = (p: StoredParticipant, st: StaticData | null) => st?.champions[p.championId]?.id ?? p.championName;

function runes(p: StoredParticipant, st: StaticData | null): RuneSetup {
  const icons: Record<string, string> = {};
  const name = (id: number) => {
    const r = st?.runes[id];
    if (r) icons[r.name] = r.icon;
    return r?.name ?? `Runa ${id}`;
  };
  const [keystone, ...rest] = p.perks.primary;
  return {
    keystone: keystone ? name(keystone) : 'Desconhecida',
    primaryTree: name(p.perks.primaryStyle),
    primary: rest.map(name),
    secondaryTree: name(p.perks.subStyle),
    secondary: p.perks.secondary.map(name),
    shards: p.perks.shards.map((id) => SHARDS[id] ?? `Fragmento ${id}`),
    icons,
  };
}

/** Converte a partida armazenada no modelo usado pelo app, do ponto de vista de um jogador. */
export function toPlayerMatch(m: StoredMatch, puuid: string, st: StaticData | null): Match | null {
  if (classify(m, puuid) !== 'analysed') return null;
  const me = m.participants.find((p) => p.puuid === puuid)!;
  const myTeam = m.teams[me.teamId];
  const foeTeam = m.teams[me.teamId === 100 ? 200 : 100];
  const opponent = m.participants.find((p) => p.teamId !== me.teamId && p.position === me.position);

  const participants: Participant[] = [...m.participants]
    .sort((a, b) => Number(b.teamId === me.teamId) - Number(a.teamId === me.teamId))
    .map((p) => ({
      name: p.name,
      tagLine: p.tagLine,
      championId: championKey(p, st),
      team: p.teamId === 100 ? 'BLUE' : 'RED',
      position: (p.position || 'MID') as Position,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      cs: p.cs,
      gold: p.gold,
      damage: p.damage,
      isPlayer: p.puuid === puuid,
    }));

  return {
    id: m.matchId,
    timestamp: m.gameCreation,
    durationSec: m.durationSec,
    queue: QUEUES[m.queueId],
    win: me.win,
    championId: championKey(me, st),
    position: me.position as Position,
    opponentChampionId: opponent ? championKey(opponent, st) : championKey(me, st),
    kills: me.kills,
    deaths: me.deaths,
    assists: me.assists,
    cs: me.cs,
    gold: me.gold,
    damageDealt: me.damage,
    damageTaken: me.damageTaken,
    visionScore: me.vision,
    teamKills: Math.max(myTeam?.kills ?? 0, me.kills),
    firstBlood: me.firstBlood,
    items: me.items,
    trinket: me.trinket,
    runes: runes(me, st),
    skillOrder: [],
    participants,
    objectives: {
      dragons: myTeam?.dragons ?? 0,
      barons: myTeam?.barons ?? 0,
      heralds: myTeam?.heralds ?? 0,
      towers: myTeam?.towers ?? 0,
      enemyDragons: foeTeam?.dragons ?? 0,
      enemyBarons: foeTeam?.barons ?? 0,
      enemyTowers: foeTeam?.towers ?? 0,
      playerParticipations: me.objectiveTakedowns ?? undefined,
    },
    timeline: [],
    summonerSpells: st ? me.spells.map((id) => st.spells[id]).filter(Boolean) : undefined,
    detailsLoaded: false,
    itemsInPurchaseOrder: false,
  };
}

const SKILL = ['Q', 'W', 'E', 'R'] as const;

/** Extrai, da linha do tempo, a ordem de habilidades, os itens concluídos e os acontecimentos do jogador. */
export function toMatchDetails(timeline: TimelineDto, m: StoredMatch, puuid: string, st: StaticData | null): MatchDetails {
  const me = m.participants.find((p) => p.puuid === puuid);
  const myId = timeline.info.participants?.find((p) => p.puuid === puuid)?.participantId ?? me?.participantId ?? -1;
  const myTeam = me?.teamId ?? 100;
  const byId = new Map(m.participants.map((p) => [p.participantId, p]));
  const champName = (id?: number) => {
    const p = id ? byId.get(id) : undefined;
    return p ? (st?.champions[p.championId]?.name ?? p.championName) : 'um inimigo';
  };

  const skillOrder: MatchDetails['skillOrder'] = [];
  const itemOrder: number[] = [];
  const events: TimelineEvent[] = [];
  let firstKillSeen = false;
  let firstTowerSeen = false;
  const minute = (ts: number) => Math.floor(ts / 60_000);

  for (const frame of timeline.info.frames) {
    for (const e of frame.events) {
      switch (e.type) {
        case 'SKILL_LEVEL_UP':
          if (e.participantId === myId && e.levelUpType !== 'EVOLVE' && e.skillSlot && e.skillSlot <= 4) skillOrder.push(SKILL[e.skillSlot - 1]);
          break;
        case 'ITEM_PURCHASED':
          if (e.participantId === myId && e.itemId && st?.items[e.itemId]?.completed && !itemOrder.includes(e.itemId)) {
            itemOrder.push(e.itemId);
            events.push({ minute: minute(e.timestamp), kind: 'ITEM', text: `Concluiu ${st.items[e.itemId].name}`, positive: true });
          }
          break;
        case 'CHAMPION_KILL': {
          const first = !firstKillSeen;
          firstKillSeen = true;
          if (e.killerId === myId) {
            events.push({ minute: minute(e.timestamp), kind: 'KILL', text: `${first ? 'Primeiro abate: eliminou' : 'Eliminou'} ${champName(e.victimId)}`, positive: true });
          } else if (e.victimId === myId) {
            events.push({ minute: minute(e.timestamp), kind: 'DEATH', text: e.killerId ? `Foi eliminado por ${champName(e.killerId)}` : 'Foi executado', positive: false });
          }
          break;
        }
        case 'ELITE_MONSTER_KILL': {
          const ours = e.killerTeamId === myTeam;
          const who = ours ? 'Sua equipe garantiu' : 'Equipe inimiga garantiu';
          if (e.monsterType === 'DRAGON') {
            const elder = e.monsterSubType === 'ELDER_DRAGON';
            events.push({ minute: minute(e.timestamp), kind: 'DRAGON', text: `${who} ${elder ? 'o Dragão Ancião' : 'um Dragão'}`, positive: ours });
          } else if (e.monsterType === 'BARON_NASHOR') {
            events.push({ minute: minute(e.timestamp), kind: 'BARON', text: `${who} o Barão Na'Shor`, positive: ours });
          } else if (e.monsterType === 'RIFTHERALD') {
            events.push({ minute: minute(e.timestamp), kind: 'HERALD', text: `${who} o Arauto do Vale`, positive: ours });
          }
          break;
        }
        case 'BUILDING_KILL': {
          // teamId é a equipe DONA da estrutura destruída.
          const ours = e.teamId !== myTeam;
          if (e.buildingType === 'TOWER_BUILDING' && !firstTowerSeen) {
            firstTowerSeen = true;
            events.push({ minute: minute(e.timestamp), kind: 'TOWER', text: ours ? 'Sua equipe destruiu a primeira torre' : 'Equipe inimiga destruiu a primeira torre', positive: ours });
          } else if (e.buildingType === 'INHIBITOR_BUILDING') {
            events.push({ minute: minute(e.timestamp), kind: 'TOWER', text: ours ? 'Sua equipe destruiu um inibidor' : 'Equipe inimiga destruiu um inibidor', positive: ours });
          }
          break;
        }
        case 'GAME_END': {
          const won = e.winningTeam === myTeam;
          events.push({ minute: minute(e.timestamp), kind: 'END', text: won ? 'Nexus inimigo destruído' : 'Nexus aliado destruído', positive: won });
          break;
        }
      }
    }
  }

  if (!events.some((e) => e.kind === 'END') && me) {
    events.push({ minute: Math.floor(m.durationSec / 60), kind: 'END', text: me.win ? 'Nexus inimigo destruído' : 'Nexus aliado destruído', positive: me.win });
  }
  return { skillOrder, timeline: events, itemOrder, analysis: toAnalysis(timeline, m, myId, st) };
}

/** Tamanho aproximado do Summoner's Rift nas coordenadas da Riot. */
const MAP_SIZE = 15000;
const norm = (v: number) => Math.min(1, Math.max(0, v / MAP_SIZE));

/**
 * Dados para o relatório pós-partida: diferença de ouro/CS/XP para o oponente
 * de rota a cada minuto (participantFrames), onde e como o jogador morreu,
 * onde abateu e quando colocou ou destruiu sentinelas.
 */
export function toAnalysis(timeline: TimelineDto, m: StoredMatch, myId: number, st: StaticData | null): MatchAnalysis {
  const me = m.participants.find((p) => p.participantId === myId);
  const opp = me ? m.participants.find((p) => p.teamId !== me.teamId && p.position && p.position === me.position) : undefined;
  const champId = (pid?: number) => {
    const p = pid ? m.participants.find((x) => x.participantId === pid) : undefined;
    return p ? (st?.champions[p.championId]?.id ?? p.championName) : undefined;
  };
  const frames: MatchAnalysis['frames'] = [];
  const deaths: AnalysisDeath[] = [];
  const kills: MatchAnalysis['kills'] = [];
  const wardsPlaced: number[] = [];
  const wardsKilled: number[] = [];
  const minuteOf = (ts: number) => Math.round((ts / 60_000) * 10) / 10;

  timeline.info.frames.forEach((frame, i) => {
    const pf = frame.participantFrames;
    const a = pf?.[String(myId)];
    const b = opp ? pf?.[String(opp.participantId)] : undefined;
    if (a) {
      const cs = a.minionsKilled + a.jungleMinionsKilled;
      frames.push({
        minute: i,
        goldDiff: b ? a.totalGold - b.totalGold : 0,
        csDiff: b ? cs - (b.minionsKilled + b.jungleMinionsKilled) : 0,
        xpDiff: b ? a.xp - b.xp : 0,
        cs,
      });
    }
    for (const e of frame.events) {
      if (e.type === 'CHAMPION_KILL' && e.position) {
        const p = { x: norm(e.position.x), y: norm(e.position.y) };
        if (e.victimId === myId) {
          deaths.push({ ...p, minute: minuteOf(e.timestamp), killerChampionId: champId(e.killerId), enemiesInvolved: (e.killerId ? 1 : 0) + (e.assistingParticipantIds?.length ?? 0) });
        } else if (e.killerId === myId) {
          kills.push({ ...p, minute: minuteOf(e.timestamp) });
        }
      } else if (e.type === 'WARD_PLACED' && e.creatorId === myId && e.wardType !== 'UNDEFINED') {
        wardsPlaced.push(minuteOf(e.timestamp));
      } else if (e.type === 'WARD_KILL' && e.killerId === myId) {
        wardsKilled.push(minuteOf(e.timestamp));
      }
    }
  });
  return { frames, deaths, kills, wardsPlaced, wardsKilled, playerTeam: me?.teamId === 200 ? 'RED' : 'BLUE' };
}
