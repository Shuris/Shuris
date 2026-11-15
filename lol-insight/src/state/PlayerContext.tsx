import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { dataSource, type AccountQuery, type AccountSuggestion } from '@/services';
import { loadLastAccount, loadRecentSearches, saveLastAccount, saveRecentSearches } from '@/services/storage';
import { byChampion, newestFirst, streaks, summarize, type ChampionStats, type Streaks, type Summary } from '@/stats/aggregate';
import { computeIdentity, type Identity } from '@/stats/identity';
import { computeInsights, type InsightReport } from '@/stats/insights';
import { absoluteToRank, rankToAbsolute } from '@/stats/rank';
import type { Match, Player, PlayerBundle, Rank } from '@/types';

export type LoadStatus = 'loading' | 'ready';

export interface Derived {
  player: Player;
  /** Partidas da mais recente para a mais antiga. */
  matches: Match[];
  asOf: number;
  summary: Summary;
  champions: ChampionStats[];
  streaks: Streaks;
  insights: InsightReport;
  identity: Identity;
  /** Melhor elo já registrado (temporada atual + anteriores). */
  peakRank: Rank;
}

interface PlayerContextValue {
  status: LoadStatus;
  data: Derived | null;
  /** Última busca sem resultado (exibida na tela inicial). */
  notFound: AccountQuery | null;
  error: string | null;
  recent: AccountSuggestion[];
  suggestions: AccountSuggestion[];
  search: (query: AccountQuery) => Promise<boolean>;
  dismissNotFound: () => void;
}

const Ctx = createContext<PlayerContextValue | null>(null);
const DEFAULT_ACCOUNT: AccountSuggestion = { gameName: 'Gregory', tagLine: 'BR1', region: 'BR' };

function derive(bundle: PlayerBundle): Derived {
  const matches = newestFirst(bundle.matches);
  const peaks = [
    ...bundle.matches.filter((m) => m.rankAfter).map((m) => rankToAbsolute(m.rankAfter!)),
    ...bundle.player.seasonHistory.map((s) => rankToAbsolute(s.rank)),
    rankToAbsolute(bundle.player.rank),
  ];
  return {
    player: bundle.player,
    matches,
    asOf: bundle.asOf,
    summary: summarize(matches),
    champions: byChampion(matches),
    streaks: streaks(matches),
    insights: computeInsights(matches),
    identity: computeIdentity(matches),
    peakRank: absoluteToRank(Math.max(...peaks)),
  };
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [bundle, setBundle] = useState<PlayerBundle | null>(null);
  const [notFound, setNotFound] = useState<AccountQuery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<AccountSuggestion[]>([]);
  const [suggestions, setSuggestions] = useState<AccountSuggestion[]>([]);
  const requestId = useRef(0);

  const search = useCallback(async (query: AccountQuery) => {
    const id = ++requestId.current;
    setStatus('loading');
    setError(null);
    setNotFound(null);
    try {
      const result = await dataSource.loadAccount(query);
      if (id !== requestId.current) return false;
      if (!result) {
        setNotFound(query);
        return false;
      }
      setBundle(result);
      const account = { gameName: result.player.gameName, tagLine: result.player.tagLine, region: result.player.region };
      void saveLastAccount(account);
      setRecent((prev) => {
        const next = [account, ...prev.filter((r) => !(r.gameName === account.gameName && r.tagLine === account.tagLine))].slice(0, 5);
        void saveRecentSearches(next);
        return next;
      });
      return true;
    } catch (e) {
      if (id === requestId.current) setError(e instanceof Error ? e.message : 'Não foi possível carregar os dados.');
      return false;
    } finally {
      if (id === requestId.current) setStatus('ready');
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [last, recents, sugg] = await Promise.all([loadLastAccount(), loadRecentSearches(), dataSource.suggestions()]);
      setRecent(recents);
      setSuggestions(sugg);
      const ok = await search(last ?? DEFAULT_ACCOUNT);
      if (!ok && last) await search(DEFAULT_ACCOUNT);
    })();
  }, [search]);

  const data = useMemo(() => (bundle ? derive(bundle) : null), [bundle]);
  const value = useMemo<PlayerContextValue>(
    () => ({ status, data, notFound, error, recent, suggestions, search, dismissNotFound: () => setNotFound(null) }),
    [status, data, notFound, error, recent, suggestions, search],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePlayer deve ser usado dentro de <PlayerProvider>');
  return ctx;
}
