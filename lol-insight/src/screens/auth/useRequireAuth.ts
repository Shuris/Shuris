import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { useAuth } from '@/state/AuthContext';

/**
 * Telas privadas: sem sessão, volta ao login. A proteção real é no servidor.
 * `leave(destino)` é usado quando a própria tela encerra a sessão (sair, excluir a
 * conta): o destino escolhido tem prioridade sobre o redirecionamento automático.
 */
export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();
  const leaving = useRef<Href | null>(null);

  useEffect(() => {
    if (auth.status !== 'signedOut') return;
    router.replace(leaving.current ?? '/entrar');
  }, [auth.status, router]);

  const leave = useCallback((to: Href | null) => {
    leaving.current = to;
  }, []);

  return { ...auth, leave };
}
