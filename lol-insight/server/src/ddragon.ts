import type { Champion, ChampionClass } from '../../src/types/index.ts';
import type { Repositories } from './db/repositories.ts';
import { silentLogger, type Logger } from './logger.ts';

const BASE = 'https://ddragon.leagueoflegends.com';
const MEMORY_TTL_MS = 6 * 3_600_000;
const DB_TTL_MS = 7 * 86_400_000;
const CACHE_KEY = 'ddragon:static:v1';

export interface StaticData {
  version: string;
  /** Campeões indexados pelo ID numérico usado no Match-V5 e no Champion-Mastery-V4. */
  champions: Record<string, Champion>;
  items: Record<string, { name: string; completed: boolean }>;
  /** Runas e árvores indexadas por ID; `icon` é o caminho relativo a /cdn/img/. */
  runes: Record<string, { name: string; icon: string }>;
  /** Feitiços de invocador indexados por ID; `icon` é o nome do arquivo em /cdn/{versão}/img/spell/. */
  spells: Record<string, { name: string; icon: string }>;
}

type JsonFetch = (url: string) => Promise<unknown>;

const TAGS: Record<string, ChampionClass> = {
  Mage: 'MAGE',
  Assassin: 'ASSASSIN',
  Marksman: 'MARKSMAN',
  Fighter: 'FIGHTER',
  Tank: 'TANK',
  Support: 'SUPPORT',
};

/** Cor estável derivada do nome, usada no avatar de reserva quando a imagem não carrega. */
export function colorFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = 0.42 - 0.3 * Math.max(-1, Math.min(k - 3, 9 - k, 1)) * 0.55;
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const defaultFetch: JsonFetch = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Data Dragon HTTP ${res.status}`);
  return res.json();
};

/**
 * Data Dragon: catálogo oficial (campeões, itens, runas, feitiços) na versão
 * mais recente do jogo. É público e não usa a chave da Riot.
 * Fica em memória por 6 h e no banco por 7 dias; se o CDN estiver fora, usa a
 * última cópia armazenada.
 */
export class DataDragon {
  private memory: { data: StaticData; at: number } | null = null;
  private pending: Promise<StaticData | null> | null = null;

  constructor(
    private repos: Repositories,
    private locale = 'pt_BR',
    private fetchJson: JsonFetch = defaultFetch,
    private logger: Logger = silentLogger,
    private now: () => number = Date.now,
  ) {}

  async get(): Promise<StaticData | null> {
    if (this.memory && this.now() - this.memory.at < MEMORY_TTL_MS) return this.memory.data;
    this.pending ??= this.load().finally(() => (this.pending = null));
    return this.pending;
  }

  private async load(): Promise<StaticData | null> {
    const now = this.now();
    const cached = this.repos.cacheGet<StaticData>(CACHE_KEY, now);
    if (cached) {
      this.memory = { data: cached, at: now };
      return cached;
    }
    try {
      const versions = (await this.fetchJson(`${BASE}/api/versions.json`)) as string[];
      const version = versions[0];
      const base = `${BASE}/cdn/${version}/data/${this.locale}`;
      const [champs, items, runes, spells] = (await Promise.all([
        this.fetchJson(`${base}/champion.json`),
        this.fetchJson(`${base}/item.json`),
        this.fetchJson(`${base}/runesReforged.json`),
        this.fetchJson(`${base}/summoner.json`),
      ])) as [any, any, any, any];

      const data: StaticData = { version, champions: {}, items: {}, runes: {}, spells: {} };
      for (const c of Object.values<any>(champs.data)) {
        data.champions[c.key] = {
          id: c.id,
          name: c.name,
          title: c.title ? c.title[0].toUpperCase() + c.title.slice(1) : '',
          classes: (c.tags as string[]).map((t) => TAGS[t]).filter(Boolean),
          color: colorFor(c.id),
        };
      }
      for (const [id, it] of Object.entries<any>(items.data)) {
        const tags: string[] = it.tags ?? [];
        data.items[id] = {
          name: String(it.name).replace(/<[^>]+>/g, ''),
          completed: !it.into?.length && (it.gold?.total ?? 0) >= 1600 && !tags.includes('Consumable') && !tags.includes('Trinket'),
        };
      }
      for (const tree of runes as any[]) {
        data.runes[tree.id] = { name: tree.name, icon: tree.icon };
        for (const slot of tree.slots) for (const r of slot.runes) data.runes[r.id] = { name: r.name, icon: r.icon };
      }
      for (const s of Object.values<any>(spells.data)) data.spells[s.key] = { name: s.name, icon: s.image.full };

      this.repos.cacheSet(CACHE_KEY, data, DB_TTL_MS, now);
      this.memory = { data, at: now };
      this.logger.info('ddragon: catálogo carregado', { version, champions: Object.keys(data.champions).length });
      return data;
    } catch (e) {
      this.logger.warn('ddragon: indisponível', { reason: e instanceof Error ? e.message : String(e) });
      const stale = this.repos.cacheGet<StaticData>(CACHE_KEY, now, true);
      if (stale) this.memory = { data: stale, at: now - MEMORY_TTL_MS + 600_000 }; // tenta de novo em 10 min
      return stale;
    }
  }
}
