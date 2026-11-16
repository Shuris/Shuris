import { Readable } from 'node:stream';

import type { Authenticated } from '../src/auth/authService.ts';
import { MemoryMailer } from '../src/auth/mailer.ts';
import { TEST_PARAMS } from '../src/auth/password.ts';
import type { Config } from '../src/config.ts';
import { createHttpHandler, httpDepsFrom } from '../src/http/server.ts';
import { createApp, type App } from '../src/app.ts';
import { silentLogger } from '../src/logger.ts';
import type { Clock } from '../src/riot/rateLimiter.ts';
import type { MatchDto, ParticipantDto, TimelineDto } from '../src/riot/types.ts';

export const KEY = 'RGAPI-00000000-test-test-test-000000000000';
export const PUUID = 'puuid-gregory-000000000000000000000000';

/** Relógio virtual: `sleep` avança o tempo na hora, então esperas de rate limit não atrasam os testes. */
export class FakeClock implements Clock {
  t = 1_700_000_000_000;
  slept: number[] = [];
  now() {
    return this.t;
  }
  async sleep(ms: number) {
    this.slept.push(ms);
    this.t += ms;
    await Promise.resolve();
  }
}

export interface PlayerLine {
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs?: number;
  position?: string;
  championId?: number;
  championName?: string;
}

const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];

/** Monta um MatchDto no formato do Match-V5, com o jogador de teste em uma posição que não é a primeira. */
export function makeMatch(n: number, line: PlayerLine, opts: { queueId?: number; duration?: number; puuid?: string } = {}): MatchDto {
  const puuid = opts.puuid ?? PUUID;
  const myRole = line.position ?? 'MIDDLE';
  const participants: ParticipantDto[] = [];
  for (let i = 0; i < 10; i++) {
    const teamId = i < 5 ? 100 : 200;
    const role = ROLES[i % 5];
    const isMe = teamId === 200 && role === myRole; // jogador na equipe vermelha
    const win = teamId === 200 ? line.win : !line.win;
    participants.push({
      puuid: isMe ? puuid : `other-${n}-${i}`,
      participantId: i + 1,
      riotIdGameName: isMe ? 'Gregory' : `Jogador${i}`,
      riotIdTagline: 'BR1',
      championId: isMe ? (line.championId ?? 142) : 1 + i,
      championName: isMe ? (line.championName ?? 'Zoe') : `Champ${i}`,
      champLevel: 16,
      teamId,
      teamPosition: role,
      win,
      kills: isMe ? line.kills : 2,
      deaths: isMe ? line.deaths : 3,
      assists: isMe ? line.assists : 4,
      totalMinionsKilled: isMe ? (line.cs ?? 200) - 20 : 150,
      neutralMinionsKilled: isMe ? 20 : 5,
      goldEarned: isMe ? 12_000 : 9000,
      totalDamageDealtToChampions: isMe ? 25_000 : 15_000,
      totalDamageTaken: 18_000,
      visionScore: 22,
      firstBloodKill: isMe && n % 2 === 0,
      item0: 6655,
      item1: 3020,
      item2: 3089,
      item3: 0,
      item4: 0,
      item5: 0,
      item6: 3363,
      summoner1Id: 4,
      summoner2Id: 14,
      perks: {
        statPerks: { offense: 5008, flex: 5008, defense: 5001 },
        styles: [
          { description: 'primaryStyle', style: 8100, selections: [{ perk: 8112 }, { perk: 8139 }, { perk: 8138 }, { perk: 8106 }] },
          { description: 'subStyle', style: 8200, selections: [{ perk: 8226 }, { perk: 8210 }] },
        ],
      },
      challenges: isMe ? { dragonTakedowns: 2, baronTakedowns: 1, riftHeraldTakedowns: 0 } : undefined,
    });
  }
  const teamKills = (id: number) => participants.filter((p) => p.teamId === id).reduce((s, p) => s + p.kills, 0);
  const start = 1_699_000_000_000 + n * 3_600_000;
  const duration = opts.duration ?? 1800;
  return {
    metadata: { matchId: `BR1_${3_000_000_000 + n}`, participants: participants.map((p) => p.puuid) },
    info: {
      gameCreation: start,
      gameStartTimestamp: start,
      gameEndTimestamp: start + duration * 1000,
      gameDuration: duration,
      gameVersion: '15.22.1',
      queueId: opts.queueId ?? 420,
      participants,
      teams: [100, 200].map((teamId) => ({
        teamId,
        win: participants.find((p) => p.teamId === teamId)!.win,
        objectives: {
          champion: { kills: teamKills(teamId) },
          dragon: { kills: teamId === 200 ? 3 : 1 },
          baron: { kills: teamId === 200 ? 1 : 0 },
          riftHerald: { kills: 1 },
          tower: { kills: teamId === 200 ? 9 : 2 },
        },
      })),
    },
  };
}

export function makeTimeline(match: MatchDto, puuid = PUUID): TimelineDto {
  const me = match.info.participants.find((p) => p.puuid === puuid)!;
  const foe = match.info.participants.find((p) => p.teamId !== me.teamId)!;
  const laneFoe = match.info.participants.find((p) => p.teamId !== me.teamId && p.teamPosition === me.teamPosition) ?? foe;
  const frame = (myGold: number, foeGold: number, myCs: number, foeCs: number) => ({
    [String(me.participantId)]: { totalGold: myGold, xp: myGold, minionsKilled: myCs, jungleMinionsKilled: 0 },
    [String(laneFoe.participantId)]: { totalGold: foeGold, xp: foeGold - 100, minionsKilled: foeCs, jungleMinionsKilled: 0 },
  });
  return {
    metadata: match.metadata,
    info: {
      participants: match.info.participants.map((p) => ({ participantId: p.participantId, puuid: p.puuid })),
      frames: [
        {
          timestamp: 0,
          participantFrames: frame(500, 500, 0, 0),
          events: [
            { type: 'SKILL_LEVEL_UP', timestamp: 5000, participantId: me.participantId, skillSlot: 1, levelUpType: 'NORMAL' },
            { type: 'SKILL_LEVEL_UP', timestamp: 90_000, participantId: me.participantId, skillSlot: 3, levelUpType: 'NORMAL' },
            { type: 'SKILL_LEVEL_UP', timestamp: 95_000, participantId: foe.participantId, skillSlot: 2, levelUpType: 'NORMAL' },
          ],
        },
        {
          timestamp: 180_000,
          participantFrames: frame(1700, 1400, 24, 18),
          events: [
            { type: 'WARD_PLACED', timestamp: 150_000, creatorId: me.participantId, wardType: 'YELLOW_TRINKET' },
            { type: 'WARD_KILL', timestamp: 420_000, killerId: me.participantId, wardType: 'SIGHT_WARD' },
            { type: 'CHAMPION_KILL', timestamp: 185_000, killerId: me.participantId, victimId: foe.participantId, position: { x: 7500, y: 7500 } },
            { type: 'SKILL_LEVEL_UP', timestamp: 190_000, participantId: me.participantId, skillSlot: 2, levelUpType: 'NORMAL' },
            { type: 'ELITE_MONSTER_KILL', timestamp: 400_000, monsterType: 'DRAGON', monsterSubType: 'FIRE_DRAGON', killerTeamId: me.teamId },
            { type: 'CHAMPION_KILL', timestamp: 500_000, killerId: foe.participantId, victimId: me.participantId, assistingParticipantIds: [laneFoe.participantId === foe.participantId ? foe.participantId + 1 : laneFoe.participantId], position: { x: 4500, y: 10500 } },
            { type: 'ITEM_PURCHASED', timestamp: 720_000, participantId: me.participantId, itemId: 1001 },
            { type: 'ITEM_PURCHASED', timestamp: 780_000, participantId: me.participantId, itemId: 6655 },
            { type: 'BUILDING_KILL', timestamp: 800_000, buildingType: 'TOWER_BUILDING', teamId: me.teamId === 100 ? 200 : 100 },
            { type: 'GAME_END', timestamp: 1_800_000, winningTeam: me.win ? me.teamId : foe.teamId },
          ],
        },
      ],
    },
  };
}

type Handler = (url: URL) => { status: number; body?: unknown; headers?: Record<string, string> } | undefined;

/** Substituto da Riot API: responde no formato dos endpoints reais e registra cada chamada recebida. */
export class FakeRiot {
  calls: Array<{ host: string; path: string; search: string; key: string | undefined }> = [];
  account: { puuid: string; gameName: string; tagLine: string } | null = { puuid: PUUID, gameName: 'Gregory', tagLine: 'BR1' };
  summoner: { profileIconId: number; summonerLevel: number } | null = { profileIconId: 29, summonerLevel: 287 };
  activeRegion: string | null = 'br1';
  league: unknown[] = [
    { queueType: 'RANKED_SOLO_5x5', tier: 'DIAMOND', rank: 'III', leaguePoints: 64, wins: 93, losses: 78, hotStreak: false },
    { queueType: 'RANKED_FLEX_SR', tier: 'EMERALD', rank: 'I', leaguePoints: 12, wins: 10, losses: 9 },
  ];
  mastery: unknown[] = [
    { championId: 142, championLevel: 21, championPoints: 250_000, lastPlayTime: 1_699_900_000_000 },
    { championId: 103, championLevel: 9, championPoints: 80_000, lastPlayTime: 1_699_800_000_000 },
  ];
  /** Partidas, da mais recente para a mais antiga. */
  matches: MatchDto[] = [];
  /** Intercepta chamadas antes do roteamento padrão (para injetar 429, 5xx, 403...). */
  intercept: Handler | null = null;

  fetch = async (url: string, init: { headers: Record<string, string> }): Promise<Response> => {
    const u = new URL(url);
    this.calls.push({ host: u.host, path: u.pathname, search: u.search, key: init.headers['X-Riot-Token'] });
    const r = this.intercept?.(u) ?? this.route(u);
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
      status: r.status,
      headers: { 'content-type': 'application/json', 'x-app-rate-limit': '20:1,100:120', ...r.headers },
    });
  };

  count(fragment: string): number {
    return this.calls.filter((c) => c.path.includes(fragment)).length;
  }

  private route(u: URL): { status: number; body?: unknown; headers?: Record<string, string> } {
    const p = decodeURIComponent(u.pathname);
    const notFound = { status: 404, body: { status: { status_code: 404, message: 'Data not found' } } };
    if (p.startsWith('/riot/account/v1/accounts/by-riot-id/')) {
      const [name, tag] = p.split('/').slice(-2);
      const a = this.account;
      return a && a.gameName.toLowerCase() === name.toLowerCase() && a.tagLine.toLowerCase() === tag.toLowerCase() ? { status: 200, body: a } : notFound;
    }
    if (p.startsWith('/riot/account/v1/region/by-game/lol/by-puuid/')) {
      return this.activeRegion ? { status: 200, body: { puuid: PUUID, game: 'lol', region: this.activeRegion } } : notFound;
    }
    if (p.startsWith('/lol/summoner/v4/summoners/by-puuid/')) {
      const expected = this.activeRegion ? `${this.activeRegion}.api.riotgames.com` : '';
      return this.summoner && u.host === expected ? { status: 200, body: { puuid: PUUID, ...this.summoner } } : notFound;
    }
    if (p.startsWith('/lol/league/v4/entries/by-puuid/')) return { status: 200, body: this.league };
    if (p.startsWith('/lol/champion-mastery/v4/champion-masteries/by-puuid/')) return { status: 200, body: this.mastery };
    if (p.endsWith('/ids')) {
      const start = Number(u.searchParams.get('start') ?? 0);
      const count = Number(u.searchParams.get('count') ?? 20);
      return { status: 200, body: this.matches.slice(start, start + count).map((m) => m.metadata.matchId) };
    }
    if (p.endsWith('/timeline')) {
      const id = p.split('/').at(-2);
      const m = this.matches.find((x) => x.metadata.matchId === id);
      return m ? { status: 200, body: makeTimeline(m) } : notFound;
    }
    if (p.startsWith('/lol/match/v5/matches/')) {
      const m = this.matches.find((x) => x.metadata.matchId === p.split('/').pop());
      return m ? { status: 200, body: m } : notFound;
    }
    return notFound;
  }
}

/** Data Dragon simulado, no formato dos arquivos reais. */
export const fakeDdragon = async (url: string): Promise<unknown> => {
  if (url.endsWith('/api/versions.json')) return ['15.22.1', '15.21.1'];
  if (url.endsWith('/champion.json')) {
    return {
      data: {
        Zoe: { id: 'Zoe', key: '142', name: 'Zoe', title: 'o Aspecto do Crepúsculo', tags: ['Mage'] },
        Ahri: { id: 'Ahri', key: '103', name: 'Ahri', title: 'a Raposa de Nove Caudas', tags: ['Mage', 'Assassin'] },
        MonkeyKing: { id: 'MonkeyKing', key: '62', name: 'Wukong', title: 'o Rei Macaco', tags: ['Fighter', 'Tank'] },
      },
    };
  }
  if (url.endsWith('/item.json')) {
    return {
      data: {
        '6655': { name: 'Companheiro de Luden', gold: { total: 2850 }, tags: ['SpellDamage'] },
        '3020': { name: 'Sapatos do Feiticeiro', gold: { total: 1100 }, tags: ['Boots'] },
        '3089': { name: 'Capuz da Morte de Rabadon', gold: { total: 3600 } },
        '1001': { name: 'Botas', gold: { total: 300 }, into: ['3020'] },
        '3363': { name: 'Alteração da Visão Longínqua', gold: { total: 0 }, tags: ['Trinket'] },
      },
    };
  }
  if (url.endsWith('/runesReforged.json')) {
    return [
      {
        id: 8100,
        key: 'Domination',
        icon: 'perk-images/Styles/7200_Domination.png',
        name: 'Dominação',
        slots: [
          { runes: [{ id: 8112, key: 'Electrocute', icon: 'perk-images/Styles/Domination/Electrocute/Electrocute.png', name: 'Eletrocutar' }] },
          { runes: [{ id: 8139, key: 'TasteOfBlood', icon: 'perk-images/Styles/Domination/TasteOfBlood/GreenTerror_TasteOfBlood.png', name: 'Gosto de Sangue' }] },
          { runes: [{ id: 8138, key: 'EyeballCollection', icon: 'perk-images/x.png', name: 'Coleção de Olhos' }] },
          { runes: [{ id: 8106, key: 'UltimateHunter', icon: 'perk-images/y.png', name: 'Caça Suprema' }] },
        ],
      },
      {
        id: 8200,
        key: 'Sorcery',
        icon: 'perk-images/Styles/7202_Sorcery.png',
        name: 'Feitiçaria',
        slots: [{ runes: [{ id: 8226, key: 'ManaflowBand', icon: 'perk-images/m.png', name: 'Faixa de Fluxo de Mana' }, { id: 8210, key: 'Transcendence', icon: 'perk-images/t.png', name: 'Transcendência' }] }],
      },
    ];
  }
  if (url.endsWith('/summoner.json')) {
    return {
      data: {
        SummonerFlash: { key: '4', name: 'Flash', image: { full: 'SummonerFlash.png' } },
        SummonerDot: { key: '14', name: 'Incendiar', image: { full: 'SummonerDot.png' } },
      },
    };
  }
  throw new Error(`URL inesperada: ${url}`);
};

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    riotApiKey: KEY,
    port: 0,
    host: '127.0.0.1',
    databaseFile: ':memory:',
    rateLimits: [
      { max: 20, windowMs: 1000 },
      { max: 100, windowMs: 120_000 },
    ],
    ddragonLocale: 'pt_BR',
    authSecret: Buffer.alloc(32, 7),
    passwordParams: TEST_PARAMS,
    mailTransport: 'console',
    rso: null,
    allowedOrigins: ['*'],
    trustProxy: false,
    ...overrides,
  };
}

export function setup(overrides: Partial<Config> = {}): { app: App; riot: FakeRiot; clock: FakeClock; mailer: MemoryMailer } {
  const riot = new FakeRiot();
  const clock = new FakeClock();
  const mailer = new MemoryMailer();
  const app = createApp(testConfig(overrides), { fetchImpl: riot.fetch, ddragonFetch: fakeDdragon, clock, logger: silentLogger, mailer });
  return { app, riot, clock, mailer };
}

export const CTX = { ip: '10.0.0.1', client: 'Teste automatizado' };

/** Cria um usuário, confirma o e-mail e devolve o contexto autenticado e os tokens. */
export async function signUp(ctx: { app: App; mailer: MemoryMailer }, username: string, opts: { verify?: boolean; ip?: string } = {}) {
  const email = `${username.toLowerCase()}@exemplo.com`;
  const password = `senha-forte-de-${username}`;
  const result = await ctx.app.auth.register({ username, email, password }, { ...CTX, ip: opts.ip ?? CTX.ip });
  let auth: Authenticated = ctx.app.auth.authenticate(`Bearer ${result.session.accessToken}`);
  if (opts.verify !== false) {
    ctx.app.auth.verifyEmail(auth, ctx.mailer.last(email, 'verify-email')!.code);
    auth = ctx.app.auth.authenticate(`Bearer ${result.session.accessToken}`);
  }
  return { auth, email, password, tokens: result.session, userId: result.user.id };
}

export interface HttpResult {
  status: number;
  json: any;
  headers: Record<string, string>;
  text: string;
}

/** Cliente HTTP em memória: chama o roteador real sem abrir porta. */
export function httpClient(app: App, ip = '10.0.0.9') {
  const handler = createHttpHandler({ ...httpDepsFrom(app), hasApiKey: () => app.client.hasKey });
  return async (method: string, url: string, opts: { body?: unknown; token?: string } = {}): Promise<HttpResult> => {
    let status = 0;
    let text = '';
    let headers: Record<string, string> = {};
    const req = Object.assign(Readable.from(opts.body === undefined ? [] : [JSON.stringify(opts.body)]), {
      url,
      method,
      headers: { ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), 'x-client': 'Teste HTTP' },
      socket: { remoteAddress: ip },
    });
    const res = { setHeader: (k: string, v: string) => (headers = { ...headers, [k]: v }), writeHead: (s: number, h: Record<string, string> = {}) => ((status = s), (headers = { ...headers, ...h })), end: (b?: string) => (text = b ?? '') };
    await handler(req as never, res as never);
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    return { status, json: parsed, headers, text };
  };
}

/** Dez partidas com resultados conhecidos: 6 vitórias, 4 derrotas. */
export function tenMatches(): MatchDto[] {
  const lines: PlayerLine[] = [
    { win: true, kills: 10, deaths: 2, assists: 8 },
    { win: true, kills: 7, deaths: 3, assists: 9 },
    { win: false, kills: 3, deaths: 7, assists: 4 },
    { win: true, kills: 12, deaths: 1, assists: 6, championId: 103, championName: 'Ahri' },
    { win: false, kills: 2, deaths: 6, assists: 5 },
    { win: true, kills: 8, deaths: 4, assists: 10 },
    { win: false, kills: 5, deaths: 8, assists: 3, position: 'JUNGLE', championId: 62, championName: 'MonkeyKing' },
    { win: true, kills: 9, deaths: 0, assists: 11 },
    { win: true, kills: 6, deaths: 5, assists: 7 },
    { win: false, kills: 4, deaths: 9, assists: 2 },
  ];
  // Índice maior = partida mais recente; a lista da Riot vem da mais recente para a mais antiga.
  return lines.map((l, i) => makeMatch(100 - i, l));
}
