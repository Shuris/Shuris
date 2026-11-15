/**
 * Verificação ao vivo da integração com a Riot (usa a chave de server/.env).
 * Uso:  npm run smoke -- "Nome#TAG" BR
 * Consulta cada endpoint uma vez e mostra o que voltou — útil para validar a
 * chave, a região e o formato das respostas antes de abrir o app.
 */
import { loadConfig } from '../src/config.ts';
import { AppError, RiotNotFoundError } from '../src/errors.ts';
import { accountHost, isRegion, matchHost, platformHost } from '../src/regions.ts';
import { RiotApi } from '../src/riot/api.ts';
import { RiotClient } from '../src/riot/client.ts';
import { RateLimiter } from '../src/riot/rateLimiter.ts';
import { toStoredMatch } from '../src/services/normalize.ts';

const [riotId = '', regionArg = 'BR'] = process.argv.slice(2);
const [gameName, tagLine] = riotId.split('#');
const region = regionArg.toUpperCase();
if (!gameName || !tagLine || !isRegion(region)) {
  console.error('Uso: npm run smoke -- "Nome#TAG" BR');
  process.exit(1);
}

const config = loadConfig();
const api = new RiotApi(new RiotClient({ apiKey: config.riotApiKey, limiter: new RateLimiter(config.rateLimits) }));
let failed = 0;

async function step<T>(label: string, host: string, run: () => Promise<T>, show: (v: T) => string): Promise<T | null> {
  try {
    const v = await run();
    console.log(`OK    ${label.padEnd(22)} ${host.padEnd(28)} ${show(v)}`);
    return v;
  } catch (e) {
    failed++;
    const why = e instanceof AppError ? `${e.code}: ${e.message}` : e instanceof RiotNotFoundError ? 'HTTP 404 (não encontrado)' : String(e);
    console.log(`FALHA ${label.padEnd(22)} ${host.padEnd(28)} ${why}`);
    return null;
  }
}

console.log(`Chave configurada: ${config.riotApiKey ? 'sim' : 'NÃO'} · região ${region}\n`);

const account = await step('Account-V1', accountHost(region), () => api.accountByRiotId(region, gameName, tagLine), (a) => `${a.gameName}#${a.tagLine}`);
if (account) {
  const puuid = account.puuid;
  await step('Summoner-V4', platformHost(region), () => api.summonerByPuuid(region, puuid), (s) => `nível ${s.summonerLevel}, ícone ${s.profileIconId}`);
  await step('League-V4', platformHost(region), () => api.leagueEntriesByPuuid(region, puuid), (l) =>
    l.length ? l.map((e) => `${e.queueType}: ${e.tier} ${e.rank} ${e.leaguePoints} LP (${e.wins}V ${e.losses}D)`).join(' | ') : 'sem ranqueadas',
  );
  await step('Champion-Mastery-V4', platformHost(region), () => api.topMasteries(region, puuid, 3), (m) => m.map((x) => `campeão ${x.championId} nv ${x.championLevel}`).join(', '));
  const ids = await step('Match-V5 (ids)', matchHost(region), () => api.matchIds(region, puuid, 0, 5), (i) => `${i.length} partidas: ${i.join(', ')}`);
  if (ids?.length) {
    await step('Match-V5 (detalhe)', matchHost(region), () => api.match(region, ids[0]), (dto) => {
      const me = toStoredMatch(dto).participants.find((p) => p.puuid === puuid);
      return me ? `${me.championName} ${me.kills}/${me.deaths}/${me.assists} ${me.win ? 'vitória' : 'derrota'} (fila ${dto.info.queueId})` : 'jogador não localizado na partida';
    });
    await step('Match-V5 (timeline)', matchHost(region), () => api.timeline(region, ids[0]), (t) => `${t.info.frames.length} quadros`);
  }
}

try {
  const versions = (await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json()) as string[];
  console.log(`OK    ${'Data Dragon'.padEnd(22)} ${'ddragon.leagueoflegends.com'.padEnd(28)} versão ${versions[0]}`);
} catch (e) {
  failed++;
  console.log(`FALHA ${'Data Dragon'.padEnd(22)} ${'ddragon.leagueoflegends.com'.padEnd(28)} ${String(e)}`);
}

console.log(failed ? `\n${failed} verificação(ões) falharam.` : '\nTodas as verificações passaram.');
process.exit(failed ? 1 : 0);
