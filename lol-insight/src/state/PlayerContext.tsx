import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { registerChampions, setDataDragonVersion } from '@/data/champions';
import { registerItemNames } from '@/data/items';
import { createDataSource, ServiceError, type AccountQuery, type AccountSuggestion, type MatchCount, type PlayerDataSource } from '@/services';
import { resolveDataDragonVersion } from '@/services/dataDragon';
import { defaultSettings, effectiveServerUrl, loadSettings, saveSettings, type Settings } from '@/services/settings';
import { loadCachedBundle, loadLastAccount, loadRecentSearches, saveCachedBundle, saveLastAccount, saveRecentSearches } from '@/services/storage';
import { byChampion, newestFirst, streaks, summarize, type ChampionStats, type Streaks, type Summary } from '@/stats/aggregate';
import { computeIdentity, type Identity } from '@/stats/identity';
import { computeInsights, type InsightReport } from '@/stats/insights';
import { absoluteToRank, rankToAbsolute } from '@/stats/rank';
import type { DataSourceKind, MasteryEntry, Match, Player, PlayerBundle, Rank, RankSnapshot, SyncStatus } from '@/types';

export type LoadStatus = 'loading' | 'ready';

export interface Derived {
  player: Player;
  /** Partidas da mais recente para a mais antiga. */
  matches: Match[];
  asOf: number;
  /** Origem destes dados: demonstração (fictícios) ou Riot API. */
  source: DataSourceKind;
  summary: Summary;
  champions: ChampionStats[];
  streaks: Streaks;
  insights: InsightReport;
  identity: Identity;
  /** Melhor elo conhecido; `null` quando não há nenhum elo registrado. */
  peakRank: Rank | null;
  rankHistory: RankSnapshot[];
  mastery: MasteryEntry[];
  sync?: SyncStatus;
  ignored?: { otherModes: number; remakes: number };
}

interface PlayerContextValue {
  status: LoadStatus;
  data: Derived | null;
  /** Erro da última busca (exibido na tela inicial com mensagem específica). */
  error: ServiceError | null;
  failedQuery: AccountQuery | null;
  /** true enquanto uma atualização silenciosa está em andamento. */
  refreshing: boolean;
  settings: Settings;
  /** Endereço do backend em uso (informado pelo usuário ou detectado). */
  serverUrl: string;
  dataSource: PlayerDataSource;
  recent: AccountSuggestion[];
  suggestions: AccountSuggestion[];
  search: (query: AccountQuery) => Promise<boolean>;
  refresh: () => void;
  setMode: (mode: DataSourceKind) => void;
  setMatchCount: (count: MatchCount) => void;
  setServerUrl: (url: string) => void;
  dismissError: () => void;
}

const Ctx = createContext<PlayerContextValue | null>(null);
const DEMO_ACCOUNT: AccountSuggestion = { gameName: 'Gregory', tagLine: 'BR1', region: 'BR' };
const MAX_POLLS = 150;

function derive(bundle: PlayerBundle): Derived {
  const matches = newestFirst(bundle.matches);
  const rankHistory = bundle.rankHistory ?? [];
  const peaks = [
    ...bundle.matches.filter((m) => m.rankAfter).map((m) => rankToAbsolute(m.rankAfter!)),
    ...bundle.player.seasonHistory.map((s) => rankToAbsolute(s.rank)),
    ...rankHistory.filter((s) => s.queue === 'SOLO').map((s) => rankToAbsolute(s.rank)),
    ...(bundle.player.rank ? [rankToAbsolute(bundle.player.rank)] : []),
  ];
  // Mestre+ compartilham a escala de LP: preserva a liga exata quando o pico é o elo atual.
  const peakAbs = peaks.length ? Math.max(...peaks) : null;
  const current = bundle.player.rank;
  return {
    player: bundle.player,
    matches,
    asOf: bundle.asOf,
    source: bundle.source,
    summary: summarize(matches),
    champions: byChampion(matches),
    streaks: streaks(matches),
    insights: computeInsights(matches),
    identity: computeIdentity(matches),
    peakRank: peakAbs === null ? null : current && rankToAbsolute(current) === peakAbs ? current : absoluteToRank(peakAbs),
    rankHistory,
    mastery: bundle.mastery ?? [],
    sync: bundle.sync,
    ignored: bundle.ignored,
  };
}

/** Disponibiliza para a interface o catálogo (campeões, itens, versão das imagens) que acompanha os dados reais. */
function registerStatic(bundle: PlayerBundle): void {
  if (bundle.champions) registerChampions(bundle.champions);
  registerItemNames(bundle.itemNames);
  setDataDragonVersion(bundle.ddragonVersion);
}

const toServiceError = (e: unknown) => (e instanceof ServiceError ? e : new ServiceError('UNKNOWN', e instanceof Error ? e.message : 'Não foi possível carregar os dados.'));

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [bundle, setBundle] = useState<PlayerBundle | null>(null);
  const [error, setError] = useState<ServiceError | null>(null);
  const [failedQuery, setFailedQuery] = useState<AccountQuery | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [recent, setRecent] = useState<AccountSuggestion[]>([]);
  const [suggestions, setSuggestions] = useState<AccountSuggestion[]>([]);
  const [, setAssetsVersion] = useState('');

  const requestId = useRef(0);
  const polls = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const current = useRef<AccountQuery | null>(null);

  const serverUrl = effectiveServerUrl(settings);
  const dataSource = useMemo(() => createDataSource(settings.mode, serverUrl), [settings.mode, serverUrl]);
  const dsRef = useRef(dataSource);
  dsRef.current = dataSource;

  /**
   * Carrega uma conta. No modo silencioso (atualização, troca de quantidade,
   * carregamento progressivo) a tela continua mostrando os dados atuais.
   */
  const load = useCallback(async (query: AccountQuery, opts: { silent?: boolean; refresh?: boolean } = {}): Promise<boolean> => {
    const id = ++requestId.current;
    const ds = dsRef.current;
    const mode = ds.kind;
    if (opts.silent) setRefreshing(true);
    else {
      polls.current = 0;
      setStatus('loading');
      setError(null);
      setFailedQuery(null);
      // Cache local: mostra a última versão conhecida da conta enquanto o servidor responde.
      if (mode === 'riot') {
        const cached = await loadCachedBundle(query);
        if (cached && id === requestId.current) {
          registerStatic(cached);
          current.current = query;
          setBundle(cached);
          setStatus('ready');
          setRefreshing(true);
        }
      }
    }
    try {
      const result = await ds.loadAccount(query, { count: settingsRef.current.matchCount, refresh: opts.refresh });
      if (id !== requestId.current) return false;
      registerStatic(result);
      setBundle(result);
      const account = { gameName: result.player.gameName, tagLine: result.player.tagLine, region: result.player.region };
      current.current = account;
      void saveLastAccount(mode, account);
      void saveCachedBundle(result);
      setRecent((prev) => {
        const next = [account, ...prev.filter((r) => !(r.gameName === account.gameName && r.tagLine === account.tagLine && r.region === account.region))].slice(0, 5);
        void saveRecentSearches(mode, next);
        return next;
      });
      return true;
    } catch (e) {
      if (id !== requestId.current) return false;
      const err = toServiceError(e);
      if (opts.silent) {
        // Mantém os dados na tela e sinaliza a falha no cartão de status.
        setBundle((b) =>
          b ? { ...b, sync: { state: 'error', requested: settingsRef.current.matchCount, available: b.sync?.available ?? b.matches.length, loaded: b.sync?.loaded ?? b.matches.length, errorCode: err.code, message: err.message, retryAfterSec: err.retryAfterSec, lastSyncedAt: b.sync?.lastSyncedAt } } : b,
        );
      } else {
        setError(err);
        setFailedQuery(query);
      }
      return false;
    } finally {
      if (id === requestId.current) {
        setStatus('ready');
        setRefreshing(false);
      }
    }
  }, []);

  /** Prepara o modo ativo: buscas recentes, sugestões e a última conta vista. */
  const bootstrap = useCallback(
    async (mode: DataSourceKind) => {
      const [last, recents, sugg] = await Promise.all([loadLastAccount(mode), loadRecentSearches(mode), dsRef.current.suggestions()]);
      setRecent(recents);
      setSuggestions(sugg);
      if (mode === 'demo') {
        const ok = await load(last ?? DEMO_ACCOUNT);
        if (!ok && last) await load(DEMO_ACCOUNT);
      } else if (last) {
        await load(last);
      } else {
        setStatus('ready'); // modo real sem conta ainda: a tela inicial convida a pesquisar
      }
    },
    [load],
  );

  // Lê as preferências salvas e descobre a versão atual das imagens oficiais.
  const [prefsReady, setPrefsReady] = useState(false);
  useEffect(() => {
    void (async () => {
      const saved = await loadSettings();
      settingsRef.current = saved;
      setSettings(saved);
      setPrefsReady(true);
      void resolveDataDragonVersion().then(setAssetsVersion);
    })();
  }, []);

  // Inicializa o modo ativo na abertura do app e a cada troca de modo.
  useEffect(() => {
    if (prefsReady) void bootstrap(settings.mode);
  }, [prefsReady, settings.mode, bootstrap]);

  // Carregamento progressivo: enquanto o servidor baixa partidas, consulta de novo.
  const syncState = bundle?.source === 'riot' ? bundle.sync?.state : undefined;
  const retryAfter = bundle?.sync?.retryAfterSec;
  const loadedSoFar = bundle?.sync?.loaded;
  useEffect(() => {
    if (syncState !== 'syncing' && syncState !== 'waiting_rate_limit') return;
    if (!current.current || polls.current >= MAX_POLLS) return;
    const delay = syncState === 'waiting_rate_limit' ? Math.min(Math.max((retryAfter ?? 5) * 1000, 3000), 15_000) : 2500;
    const timer = setTimeout(() => {
      polls.current++;
      if (current.current) void load(current.current, { silent: true });
    }, delay);
    return () => clearTimeout(timer);
  }, [syncState, retryAfter, loadedSoFar, bundle?.asOf, load]);

  const update = useCallback((patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    void saveSettings(next);
  }, []);

  const setMode = useCallback(
    (mode: DataSourceKind) => {
      if (mode === settingsRef.current.mode) return;
      requestId.current++;
      current.current = null;
      setBundle(null);
      setError(null);
      setFailedQuery(null);
      setStatus('loading');
      update({ mode });
    },
    [update],
  );

  const setMatchCount = useCallback(
    (matchCount: MatchCount) => {
      update({ matchCount });
      polls.current = 0;
      if (dsRef.current.kind === 'riot' && current.current) void load(current.current, { silent: true });
    },
    [update, load],
  );

  const refresh = useCallback(() => {
    polls.current = 0;
    if (current.current) void load(current.current, { silent: true, refresh: true });
  }, [load]);

  const data = useMemo(() => (bundle ? derive(bundle) : null), [bundle]);
  const value = useMemo<PlayerContextValue>(
    () => ({
      status,
      data,
      error,
      failedQuery,
      refreshing,
      settings,
      serverUrl,
      dataSource,
      recent,
      suggestions,
      search: (q) => load(q),
      refresh,
      setMode,
      setMatchCount,
      setServerUrl: (url) => update({ serverUrl: url.trim() }),
      dismissError: () => {
        setError(null);
        setFailedQuery(null);
      },
    }),
    [status, data, error, failedQuery, refreshing, settings, serverUrl, dataSource, recent, suggestions, load, refresh, setMode, setMatchCount, update],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePlayer deve ser usado dentro de <PlayerProvider>');
  return ctx;
}
