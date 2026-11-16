import { useEffect, useState } from 'react';

import { ServiceError } from '@/services';
import { usePlayer } from '@/state/PlayerContext';
import type { Match, MatchAnalysis } from '@/types';

/** Análises já carregadas nesta sessão do app (por origem + partida). */
const cache = new Map<string, MatchAnalysis | null>();

export type AnalysisState =
  | { status: 'loading' }
  | { status: 'ready'; analysis: MatchAnalysis | null }
  | { status: 'error'; error: ServiceError };

/**
 * Linha do tempo detalhada de uma partida para o relatório. Na demonstração é
 * gerada localmente; nos dados reais vem do backend (Match-V5 timeline, com
 * cache no servidor). Uma falha não impede o relatório: ele sai incompleto.
 */
export function useMatchAnalysis(match: Match | undefined): AnalysisState {
  const { dataSource, data } = usePlayer();
  const key = match && data ? `${data.source}:${match.id}` : '';
  const [state, setState] = useState<AnalysisState>(() =>
    match?.analysis ? { status: 'ready', analysis: match.analysis } : cache.has(key) ? { status: 'ready', analysis: cache.get(key)! } : { status: 'loading' },
  );

  useEffect(() => {
    if (!match || !data) return;
    if (match.analysis) return setState({ status: 'ready', analysis: match.analysis });
    if (cache.has(key)) return setState({ status: 'ready', analysis: cache.get(key)! });
    let cancelled = false;
    setState({ status: 'loading' });
    dataSource
      .loadMatchDetails(match, data.player)
      .then((d) => {
        cache.set(key, d.analysis ?? null);
        if (!cancelled) setState({ status: 'ready', analysis: d.analysis ?? null });
      })
      .catch((e) => {
        if (!cancelled) setState({ status: 'error', error: e instanceof ServiceError ? e : new ServiceError('UNKNOWN', 'Não foi possível carregar a linha do tempo.') });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dataSource]);

  return state;
}
