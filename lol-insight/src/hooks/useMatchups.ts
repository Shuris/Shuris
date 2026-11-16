import { useCallback, useEffect, useMemo, useState } from 'react';

import { describeError, ServiceError } from '@/services';
import { LocalMatchupStore, RemoteMatchupStore, type MatchupNote, type MatchupStore } from '@/services/matchupNotes';
import { useAuth } from '@/state/AuthContext';
import { usePlayer } from '@/state/PlayerContext';

/** Cópia em memória por "dono" (demo ou usuário), compartilhada entre as telas abertas. */
const cache = new Map<string, MatchupNote[]>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export interface MatchupsState {
  /** false no modo real sem login: o caderno fica na conta. */
  available: boolean;
  owner: 'demo' | 'account';
  notes: MatchupNote[];
  loading: boolean;
  error: string | null;
  find: (championId: string, opponentId: string) => MatchupNote | undefined;
  save: (n: Omit<MatchupNote, 'updatedAt'>) => Promise<void>;
  remove: (championId: string, opponentId: string) => Promise<void>;
}

export function useMatchups(): MatchupsState {
  const { settings } = usePlayer();
  const auth = useAuth();
  const demo = settings.mode === 'demo';
  const available = demo || (auth.status === 'signedIn' && !!auth.user);
  const key = demo ? 'demo' : `user:${auth.user?.id ?? ''}`;
  const store: MatchupStore = useMemo(() => (demo ? new LocalMatchupStore() : new RemoteMatchupStore()), [demo]);
  const [, force] = useState(0);
  const [loading, setLoading] = useState(!cache.has(key));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    setLoading(!cache.has(key));
    store
      .list()
      .then((list) => {
        cache.set(key, list);
        if (!cancelled) setError(null);
        notify();
      })
      .catch((e) => !cancelled && setError(e instanceof ServiceError ? `${e.message} ${describeError(e.code).hint}` : 'Não foi possível carregar o caderno.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [key, available, store]);

  const notes = cache.get(key) ?? [];
  const save = useCallback(
    async (n: Omit<MatchupNote, 'updatedAt'>) => {
      const saved = await store.save(n);
      cache.set(key, [saved, ...(cache.get(key) ?? []).filter((x) => !(x.championId === n.championId && x.opponentId === n.opponentId))]);
      notify();
    },
    [key, store],
  );
  const remove = useCallback(
    async (championId: string, opponentId: string) => {
      await store.remove(championId, opponentId);
      cache.set(key, (cache.get(key) ?? []).filter((x) => !(x.championId === championId && x.opponentId === opponentId)));
      notify();
    },
    [key, store],
  );
  const find = useCallback((c: string, o: string) => notes.find((x) => x.championId === c && x.opponentId === o), [notes]);
  return { available, owner: demo ? 'demo' : 'account', notes, loading: available && loading, error, find, save, remove };
}
