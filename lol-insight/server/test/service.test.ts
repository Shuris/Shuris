import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AppError } from '../src/errors.ts';
import { createHttpHandler } from '../src/http/server.ts';
import { silentLogger } from '../src/logger.ts';
import { validateRiotId } from '../src/services/accountService.ts';
import { classify, toStoredMatch } from '../src/services/normalize.ts';
import { KEY, makeMatch, PUUID, setup, tenMatches } from './helpers.ts';

async function loaded(count = 10, refresh = false) {
  const ctx = setup();
  ctx.riot.matches = tenMatches();
  await ctx.app.accounts.getBundle('BR', 'Gregory', 'BR1', { count, refresh });
  await ctx.app.sync.idle();
  const bundle = await ctx.app.accounts.getBundle('BR', 'Gregory', 'BR1', { count });
  return { ...ctx, bundle };
}

test('1. conta brasileira válida: perfil, elo e partidas, com o roteamento correto', async () => {
  const { bundle, riot } = await loaded();
  assert.equal(bundle.source, 'riot');
  assert.equal(bundle.player.gameName, 'Gregory');
  assert.equal(bundle.player.tagLine, 'BR1');
  assert.equal(bundle.player.puuid, PUUID);
  assert.equal(bundle.player.level, 287);
  assert.equal(bundle.player.profileIconId, 29);
  assert.equal(bundle.matches.length, 10);
  assert.equal(bundle.sync?.state, 'idle');
  const host = (fragment: string) => riot.calls.find((c) => c.path.includes(fragment))!.host;
  assert.equal(host('/riot/account/v1/'), 'americas.api.riotgames.com');
  assert.equal(host('/lol/match/v5/'), 'americas.api.riotgames.com');
  assert.equal(host('/lol/summoner/v4/'), 'br1.api.riotgames.com');
  assert.equal(host('/lol/league/v4/'), 'br1.api.riotgames.com');
  assert.equal(host('/lol/champion-mastery/v4/'), 'br1.api.riotgames.com');
  assert.ok(riot.calls.every((c) => c.key === KEY));
});

test('2. conta inexistente: PLAYER_NOT_FOUND (404)', async () => {
  const { app } = setup();
  await assert.rejects(app.accounts.getBundle('BR', 'NaoExiste', 'XYZ', { count: 10 }), (e: AppError) => e.code === 'PLAYER_NOT_FOUND' && e.status === 404);
});

test('Riot ID inválido é recusado antes de qualquer chamada à Riot', async () => {
  const { app, riot } = setup();
  for (const [name, tag] of [['', 'BR1'], ['ab', 'BR1'], ['Gregory', ''], ['Gregory', 'B'], ['Gregory', 'TAGLONGA'], ['Gre#gory', 'BR1'], ['x'.repeat(17), 'BR1']]) {
    await assert.rejects(app.accounts.getBundle('BR', name, tag, { count: 10 }), (e: AppError) => e.code === 'INVALID_RIOT_ID', `${name}#${tag}`);
  }
  assert.equal(riot.calls.length, 0);
  validateRiotId('Faker', 'KR1');
  validateRiotId('Hide on bush', 'KR1');
  validateRiotId('Ação Ñ', 'BR1');
});

test('região incorreta: conta existe mas joga em outra plataforma → WRONG_REGION com sugestão', async () => {
  const { app, riot } = setup();
  riot.activeRegion = 'euw1';
  await assert.rejects(
    app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10 }),
    (e: AppError) => e.code === 'WRONG_REGION' && e.details.suggestedRegion === 'EUW' && /EUW/.test(e.message),
  );
});

test('3. elo: Solo/Duo e Flex do League-V4; conta sem ranqueada fica com elo nulo', async () => {
  const { bundle } = await loaded();
  assert.deepEqual(bundle.player.rank, { tier: 'DIAMANTE', division: 3, lp: 64 });
  assert.deepEqual(bundle.player.ranked?.solo, { rank: { tier: 'DIAMANTE', division: 3, lp: 64 }, wins: 93, losses: 78, hotStreak: false });
  assert.deepEqual(bundle.player.ranked?.flex?.rank, { tier: 'ESMERALDA', division: 1, lp: 12 });

  const un = setup();
  un.riot.league = [];
  const b = await un.app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10 });
  assert.equal(b.player.rank, null);
  assert.deepEqual(b.rankHistory, []);

  const apex = setup();
  apex.riot.league = [{ queueType: 'RANKED_SOLO_5x5', tier: 'CHALLENGER', rank: 'I', leaguePoints: 1432, wins: 300, losses: 200 }];
  assert.deepEqual((await apex.app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10 })).player.rank, { tier: 'DESAFIANTE', division: 1, lp: 1432 });
});

test('4. partidas: busca os IDs e depois os detalhes de cada uma, da mais recente para a mais antiga', async () => {
  const { bundle, riot } = await loaded();
  assert.equal(riot.count('/ids'), 1);
  assert.equal(riot.calls.filter((c) => /\/matches\/BR1_\d+$/.test(c.path)).length, 10);
  const ts = bundle.matches.map((m) => m.timestamp);
  assert.deepEqual(ts, [...ts].sort((a, b) => b - a));
  assert.equal(bundle.matches[0].id, 'BR1_3000000100');
});

test('5. estatísticas individuais: identifica o participante pelo PUUID (não pela posição na lista)', async () => {
  const { bundle } = await loaded();
  const m = bundle.matches[0]; // 10/2/8 de Zoe, vitória
  assert.equal(m.championId, 'Zoe');
  assert.deepEqual([m.kills, m.deaths, m.assists], [10, 2, 8]);
  assert.equal(m.win, true);
  assert.equal(m.position, 'MID');
  assert.equal(m.queue, 'SOLO');
  assert.equal(m.cs, 200); // tropas + monstros da selva
  assert.equal(m.gold, 12_000);
  assert.equal(m.damageDealt, 25_000);
  assert.equal(m.durationSec, 1800);
  assert.equal(m.teamKills, 10 + 2 * 4); // jogador + 4 aliados com 2 abates
  assert.deepEqual(m.items, [6655, 3020, 3089]);
  assert.equal(m.trinket, 3363);
  assert.equal(m.runes.keystone, 'Eletrocutar');
  assert.equal(m.runes.primaryTree, 'Dominação');
  assert.deepEqual(m.runes.secondary, ['Faixa de Fluxo de Mana', 'Transcendência']);
  assert.deepEqual(m.runes.shards, ['Força Adaptativa', 'Força Adaptativa', 'Vida Escalável']);
  assert.deepEqual(m.summonerSpells?.map((s) => s.name), ['Flash', 'Incendiar']);
  assert.equal(m.objectives.dragons, 3);
  assert.equal(m.objectives.enemyDragons, 1);
  assert.equal(m.objectives.playerParticipations, 3);
  assert.equal(m.participants.length, 10);
  assert.equal(m.participants.filter((p) => p.isPlayer).length, 1);
  assert.equal(m.participants.find((p) => p.isPlayer)!.team, 'RED');
  // Campeão cujo ID no Data Dragon difere do nome exibido (Wukong = MonkeyKing).
  const wukong = bundle.matches.find((x) => x.position === 'JUNGLE')!;
  assert.equal(wukong.championId, 'MonkeyKing');
  assert.equal(bundle.champions?.find((c) => c.id === 'MonkeyKing')?.name, 'Wukong');
});

test('6 e 7. win rate e KDA calculados a partir das partidas batem com os valores conhecidos', async () => {
  const { bundle } = await loaded();
  const wins = bundle.matches.filter((m) => m.win).length;
  assert.equal(wins, 6);
  assert.equal(wins / bundle.matches.length, 0.6);
  const sum = (f: (m: (typeof bundle.matches)[number]) => number) => bundle.matches.reduce((s, m) => s + f(m), 0);
  const [k, d, a] = [sum((m) => m.kills), sum((m) => m.deaths), sum((m) => m.assists)];
  assert.deepEqual([k, d, a], [66, 45, 65]);
  assert.equal(Number(((k + a) / d).toFixed(2)), 2.91);
});

test('8. imagens: versão do Data Dragon, IDs de campeão e caminhos de ícones oficiais', async () => {
  const { bundle } = await loaded();
  assert.equal(bundle.ddragonVersion, '15.22.1');
  assert.equal(bundle.champions?.find((c) => c.id === 'Ahri')?.title, 'A Raposa de Nove Caudas');
  assert.deepEqual(bundle.champions?.find((c) => c.id === 'Ahri')?.classes, ['MAGE', 'ASSASSIN']);
  assert.equal(bundle.matches[0].runes.icons?.['Eletrocutar'], 'perk-images/Styles/Domination/Electrocute/Electrocute.png');
  assert.equal(bundle.matches[0].summonerSpells?.[0].icon, 'SummonerFlash.png');
  assert.equal(bundle.itemNames?.['6655'], 'Companheiro de Luden');
  assert.deepEqual(bundle.mastery, [
    { championId: 'Zoe', level: 21, points: 250_000, lastPlayed: 1_699_900_000_000 },
    { championId: 'Ahri', level: 9, points: 80_000, lastPlayed: 1_699_800_000_000 },
  ]);
});

test('9. atualização do histórico: partidas já armazenadas não são baixadas de novo', async () => {
  const { app, riot, clock } = await loaded();
  const detailCalls = () => riot.calls.filter((c) => /\/matches\/BR1_\d+$/.test(c.path)).length;
  assert.equal(detailCalls(), 10);

  // Nova partida disputada: só ela é consultada.
  riot.matches.unshift(makeMatch(101, { win: true, kills: 20, deaths: 0, assists: 5 }));
  clock.t += 5 * 60_000;
  await app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10, refresh: true });
  await app.sync.idle();
  const bundle = await app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10 });
  assert.equal(detailCalls(), 11);
  assert.equal(bundle.matches[0].kills, 20);
  assert.equal(bundle.matches.length, 10); // janela das 10 mais recentes

  // Pedir 20 reaproveita as 11 armazenadas.
  await app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 20 });
  await app.sync.idle();
  assert.equal(detailCalls(), 11);
  assert.equal((await app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 20 })).matches.length, 11);
});

test('cache: buscas repetidas em sequência não repetem as chamadas de perfil', async () => {
  const { app, riot } = await loaded();
  const before = riot.calls.length;
  await app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10 });
  await app.accounts.getBundle('BR', 'gregory', 'br1', { count: 10 });
  assert.equal(riot.calls.length, before);
});

test('histórico de atualizações e estatísticas individuais ficam registrados no banco', async () => {
  const { app } = await loaded();
  const log = app.repos.syncHistory(PUUID) as Array<{ status: string; fetched_new: number; requested: number }>;
  assert.equal(log.length, 1);
  assert.deepEqual([log[0].status, log[0].fetched_new, log[0].requested], ['ok', 10, 10]);
  assert.equal(app.repos.countPlayerMatches(PUUID), 10);
  const row = app.db.prepare('SELECT kills, deaths, assists, win, position FROM player_matches WHERE match_id = ?').get('BR1_3000000100') as Record<string, unknown>;
  assert.deepEqual({ ...row }, { kills: 10, deaths: 2, assists: 8, win: 1, position: 'MID' });
  assert.equal(app.repos.findAccountByRiotId('BR', 'GREGORY', 'br1')?.puuid, PUUID);
});

test('snapshots de elo: registra quando o LP muda e não duplica quando está igual', async () => {
  const { app, riot, clock } = await loaded();
  assert.equal(app.repos.snapshots(PUUID).filter((s) => s.queue === 'SOLO').length, 1);

  clock.t += 10 * 60_000;
  await app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10, refresh: true });
  assert.equal(app.repos.snapshots(PUUID).filter((s) => s.queue === 'SOLO').length, 1, 'elo igual não gera novo ponto');

  (riot.league[0] as { leaguePoints: number; wins: number }).leaguePoints = 85;
  (riot.league[0] as { leaguePoints: number; wins: number }).wins = 94;
  clock.t += 30 * 60_000;
  const bundle = await app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10, refresh: true });
  const solo = bundle.rankHistory!.filter((s) => s.queue === 'SOLO');
  assert.deepEqual(solo.map((s) => s.rank.lp), [64, 85]);
  assert.ok(solo[1].t > solo[0].t);

  clock.t += 7 * 3_600_000;
  await app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10, refresh: true });
  assert.equal(app.repos.snapshots(PUUID).filter((s) => s.queue === 'SOLO').length, 3, 'ponto periódico após 6 h');
});

test('ARAM e remakes são armazenados, mas ficam fora da análise e são contados à parte', async () => {
  const ctx = setup();
  ctx.riot.matches = [
    makeMatch(5, { win: true, kills: 1, deaths: 1, assists: 1 }),
    makeMatch(4, { win: true, kills: 9, deaths: 9, assists: 9 }, { queueId: 450 }),
    makeMatch(3, { win: false, kills: 0, deaths: 0, assists: 0 }, { duration: 200 }),
  ];
  await ctx.app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10 });
  await ctx.app.sync.idle();
  const b = await ctx.app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10 });
  assert.equal(b.matches.length, 1);
  assert.deepEqual(b.ignored, { otherModes: 1, remakes: 1 });
  assert.equal(classify(toStoredMatch(ctx.riot.matches[1]), PUUID), 'otherMode');
});

test('10. rate limit durante a coleta: espera o Retry-After e conclui sem perder partidas', async () => {
  const ctx = setup();
  ctx.riot.matches = tenMatches();
  let limited = 0;
  ctx.riot.intercept = (u) => (/\/matches\/BR1_\d+$/.test(u.pathname) && limited++ < 2 ? { status: 429, headers: { 'retry-after': '10' } } : undefined);
  await ctx.app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10 });
  await ctx.app.sync.idle();
  const b = await ctx.app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10 });
  assert.equal(b.matches.length, 10);
  assert.equal(b.sync?.state, 'idle');
  assert.ok(ctx.clock.slept.some((ms) => ms >= 10_000));
});

test('10b. rate limit na busca: RATE_LIMITED com tempo de espera para conta nova', async () => {
  const ctx = setup();
  ctx.riot.intercept = () => ({ status: 429, headers: { 'retry-after': '45' } });
  await assert.rejects(ctx.app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10 }), (e: AppError) => e.code === 'RATE_LIMITED' && e.details.retryAfterSec === 45);
});

test('12. Riot fora do ar: conta já acompanhada é servida do banco, com aviso; conta nova recebe o erro', async () => {
  const { app, riot, clock } = await loaded();
  clock.t += 30 * 60_000; // expira os caches de perfil
  riot.intercept = () => ({ status: 503 });
  const b = await app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10 });
  assert.equal(b.matches.length, 10);
  assert.equal(b.sync?.state, 'error');
  assert.equal(b.sync?.errorCode, 'RIOT_UNAVAILABLE');
  assert.deepEqual(b.player.rank, { tier: 'DIAMANTE', division: 3, lp: 64 });

  const fresh = setup();
  fresh.riot.intercept = () => ({ status: 503 });
  await assert.rejects(fresh.app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10 }), (e: AppError) => e.code === 'RIOT_UNAVAILABLE');
});

test('11. servidor sem chave: MISSING_API_KEY e nenhuma chamada à Riot', async () => {
  const ctx = setup({ riotApiKey: '' });
  await assert.rejects(ctx.app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10 }), (e: AppError) => e.code === 'MISSING_API_KEY');
  assert.equal(ctx.riot.calls.length, 0);
});

test('chave expirada durante a coleta: estado de erro com o código RIOT_AUTH', async () => {
  const ctx = setup();
  ctx.riot.matches = tenMatches();
  ctx.riot.intercept = (u) => (u.pathname.endsWith('/ids') ? { status: 403 } : undefined);
  await ctx.app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10 });
  await ctx.app.sync.idle();
  const b = await ctx.app.accounts.getBundle('BR', 'Gregory', 'BR1', { count: 10 });
  assert.equal(b.sync?.state, 'error');
  assert.equal(b.sync?.errorCode, 'RIOT_AUTH');
});

test('detalhes da partida: ordem de habilidades, itens concluídos e linha do tempo; resultado fica em cache', async () => {
  const { app, riot } = await loaded();
  const d = await app.accounts.getMatchDetails('BR1_3000000100', PUUID);
  assert.deepEqual(d.skillOrder, ['Q', 'E', 'W']);
  assert.deepEqual(d.itemOrder, [6655]); // "Botas" é componente, não item concluído
  assert.deepEqual(
    d.timeline.map((e) => [e.minute, e.kind, e.positive]),
    [[3, 'KILL', true], [6, 'DRAGON', true], [8, 'DEATH', false], [13, 'ITEM', true], [13, 'TOWER', true], [30, 'END', true]],
  );
  assert.match(d.timeline[0].text, /^Primeiro abate: eliminou /);
  await app.accounts.getMatchDetails('BR1_3000000100', PUUID);
  assert.equal(riot.count('/timeline'), 1);
  await assert.rejects(app.accounts.getMatchDetails('BR1_9999999999', PUUID), (e: AppError) => e.code === 'MATCH_NOT_FOUND');
  await assert.rejects(app.accounts.getMatchDetails('BR1_3000000100', 'outro-puuid-000000000000000'), (e: AppError) => e.code === 'MATCH_NOT_FOUND');
});

test('HTTP: códigos de status, validação de parâmetros e ausência da chave nas respostas', async () => {
  const ctx = setup();
  ctx.riot.matches = tenMatches();
  const handler = createHttpHandler({ accounts: ctx.app.accounts, logger: silentLogger, hasApiKey: () => ctx.app.client.hasKey });
  const call = async (url: string, method = 'GET') => {
    let status = 0;
    let body = '';
    let headers: Record<string, string> = {};
    const res = { writeHead: (s: number, h: Record<string, string>) => ((status = s), (headers = h)), end: (b?: string) => (body = b ?? '') };
    await handler({ url, method, socket: { remoteAddress: '10.0.0.1' } } as never, res as never);
    return { status, headers, text: body, json: body ? JSON.parse(body) : null };
  };

  const health = await call('/health');
  assert.equal(health.status, 200);
  assert.equal(health.json.riotApiKeyConfigured, true);
  assert.ok(!health.text.includes('RGAPI'));

  const ok = await call('/v1/accounts/br/Gregory/BR1?count=10');
  assert.equal(ok.status, 200);
  assert.equal(ok.json.player.gameName, 'Gregory');
  assert.ok(!ok.text.includes(KEY));
  assert.equal(ok.headers['Access-Control-Allow-Origin'], '*');

  assert.equal((await call('/v1/accounts/XX/Gregory/BR1')).json.error.code, 'INVALID_REGION');
  assert.equal((await call('/v1/accounts/BR/Gregory/BR1?count=37')).json.error.code, 'INVALID_PARAMS');
  assert.equal((await call('/v1/accounts/BR/ab/BR1')).status, 400);
  const nf = await call('/v1/accounts/BR/Ninguem/BR1');
  assert.deepEqual([nf.status, nf.json.error.code], [404, 'PLAYER_NOT_FOUND']);
  assert.equal((await call('/v1/matches/BR1_3000000100/details?puuid=curto')).json.error.code, 'INVALID_PARAMS');
  assert.equal((await call('/v1/accounts/BR/Gregory/BR1', 'POST')).status, 404);
  assert.equal((await call('/qualquer')).status, 404);

  ctx.riot.account = { puuid: 'p2-0000000000000000000000', gameName: 'Outro', tagLine: 'BR1' };
  ctx.riot.intercept = () => ({ status: 429, headers: { 'retry-after': '30' } });
  const rl = await call('/v1/accounts/BR/Outro/BR1');
  assert.deepEqual([rl.status, rl.json.error.code, rl.json.error.retryAfterSec, rl.headers['Retry-After']], [429, 'RATE_LIMITED', 30, '30']);
});
