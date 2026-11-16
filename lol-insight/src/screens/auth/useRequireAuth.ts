import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/state/AuthContext';

/** Telas privadas: sem sessão, volta ao login. A proteção real é no servidor. */
export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (auth.status === 'signedOut') router.replace('/entrar');
  }, [auth.status, router]);
  return auth;
}
