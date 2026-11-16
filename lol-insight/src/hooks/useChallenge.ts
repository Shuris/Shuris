import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ChallengeAttempt, ChallengeState } from '@/challenge';
import { describeError, ServiceError } from '@/services';
import { LocalChallengeService, RemoteChallengeService, type ChallengeService } from '@/services/challengeService';
import { useAuth } from '@/state/AuthContext';
import { usePlayer } from '@/state/PlayerContext';

export interface ChallengeHook {
  /** false no modo real sem login: o progresso fica na conta. */
  available: boolean;
  service: ChallengeService | null;
  state: ChallengeState | null;
  loading: boolean;
  error: string | null;
  submit: (challengeId: string, answer: number, daily: boolean) => Promise<{ attempt: ChallengeAttempt; alreadyAnswered: boolean } | null>;
  reload: () => void;
}

/** Estado do LOL Challenge para a origem de dados atual (demonstração ou conta). */
export function useChallenge(): ChallengeHook {
  const { settings } = usePlayer();
  const auth = useAuth();
  const demo = settings.mode === 'demo';
  const available = demo || auth.status === 'signedIn';
  const service = useMemo<ChallengeService | null>(() => (!available ? null : demo ? new LocalChallengeService() : new RemoteChallengeService()), [demo, available]);
  const [state, setState] = useState<ChallengeState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!service) return setState(null);
    let cancelled = false;
    setLoading(true);
    service
      .load()
      .then((s) => !cancelled && (setState(s), setError(null)))
      .catch((e) => !cancelled && setError(e instanceof ServiceError ? `${e.message} ${describeError(e.code).hint}` : 'Não foi possível carregar os desafios.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [service, tick, auth.user?.id]);

  const submit = useCallback(
    async (challengeId: string, answer: number, daily: boolean) => {
      if (!service) return null;
      try {
        const r = await service.submit(challengeId, answer, daily);
        setState(r.state);
        return { attempt: r.attempt, alreadyAnswered: r.alreadyAnswered };
      } catch (e) {
        setError(e instanceof ServiceError ? e.message : e instanceof Error ? e.message : 'Não foi possível enviar a resposta.');
        return null;
      }
    },
    [service],
  );

  return { available, service, state, loading, error, submit, reload: () => setTick((t) => t + 1) };
}
