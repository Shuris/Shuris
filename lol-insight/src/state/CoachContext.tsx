import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { CoachReport, QuizResult } from '@/coach';
import { ServiceError } from '@/services';
import { createCoachService, type CoachContextData } from '@/services/CoachService';
import type { Rank } from '@/types';

import { useAuth } from './AuthContext';
import { usePlayer } from './PlayerContext';

interface CoachContextValue {
  /** Relatório do treinador para a conta carregada; `null` enquanto carrega ou sem conta. */
  report: CoachReport | null;
  loading: boolean;
  error: ServiceError | null;
  reload: () => void;
  submitAttempt: (lessonId: string, answers: number[], durationSec: number) => Promise<QuizResult | null>;
  setGoal: (rank: Rank | null) => Promise<void>;
  setPlanDay: (day: number, done: boolean) => Promise<void>;
}

const Ctx = createContext<CoachContextValue | null>(null);
const toError = (e: unknown) => (e instanceof ServiceError ? e : new ServiceError('UNKNOWN', e instanceof Error ? e.message : 'Não foi possível carregar o treinador.'));

/**
 * Mantém o relatório do treinador em dia com a conta carregada: sempre que
 * chegam partidas novas (ou muda a conta), o diagnóstico, o plano e a previsão
 * são recalculados.
 */
export function CoachProvider({ children }: { children: React.ReactNode }) {
  const { data, settings, serverUrl } = usePlayer();
  const auth = useAuth();
  const [report, setReport] = useState<CoachReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ServiceError | null>(null);
  const request = useRef(0);

  const ctxData = useMemo<CoachContextData | null>(
    () => (data ? { player: data.player, matches: data.matches, rankHistory: data.rankHistory, asOf: data.asOf, source: data.source } : null),
    [data],
  );
  const service = useMemo(() => createCoachService(data?.source ?? 'demo', serverUrl, settings.matchCount), [data?.source, serverUrl, settings.matchCount]);

  // Recalcula quando muda a conta, a quantidade de partidas ou o elo.
  // No modo real o treinador é do usuário (conta Riot principal), não da conta exibida na tela.
  const owner = data?.source === 'riot' ? `${auth.user?.id ?? 'anon'}|${auth.primary?.id ?? 'sem-conta'}` : '';
  const signature = data ? `${data.source}|${owner}|${data.player.id}|${data.matches.length}|${data.matches[0]?.id ?? ''}|${data.player.rank?.lp ?? 'x'}|${data.rankHistory.length}` : '';
  const dataRef = useRef(ctxData);
  dataRef.current = ctxData;

  const load = useCallback(async () => {
    const current = dataRef.current;
    const id = ++request.current;
    if (!current) {
      setReport(null);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const next = await service.getReport(current);
      if (id === request.current) {
        setReport(next);
        setError(null);
      }
    } catch (e) {
      if (id === request.current) setError(toError(e));
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    setReport((prev) => (prev && dataRef.current && prev.playerName === dataRef.current.player.gameName && prev.source === dataRef.current.source ? prev : null));
    void load();
  }, [signature, load]);

  const mutate = useCallback(
    async <T,>(run: (ctx: CoachContextData) => Promise<T>, pick: (value: T) => CoachReport): Promise<T | null> => {
      const current = dataRef.current;
      if (!current) return null;
      try {
        const value = await run(current);
        request.current++;
        setReport(pick(value));
        setError(null);
        return value;
      } catch (e) {
        setError(toError(e));
        return null;
      }
    },
    [],
  );

  const value = useMemo<CoachContextValue>(
    () => ({
      report,
      loading,
      error,
      reload: () => void load(),
      submitAttempt: async (lessonId, answers, durationSec) => (await mutate((c) => service.submitAttempt(c, lessonId, answers, durationSec), (v) => v.report))?.result ?? null,
      setGoal: async (rank) => void (await mutate((c) => service.setGoal(c, rank), (v) => v)),
      setPlanDay: async (day, done) => void (await mutate((c) => service.setPlanDay(c, day, done), (v) => v)),
    }),
    [report, loading, error, load, mutate, service],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCoach(): CoachContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCoach deve ser usado dentro de <CoachProvider>');
  return ctx;
}
