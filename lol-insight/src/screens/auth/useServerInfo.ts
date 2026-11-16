import { useEffect, useState } from 'react';

import { api } from '@/services/apiClient';

/** Lê /health para saber se o servidor está em modo de desenvolvimento de e-mail. */
export function useEmailDelivery(): string | null {
  const [mode, setMode] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .request<{ emailDelivery?: string }>('/health', { auth: false, timeoutMs: 5000 })
      .then((h) => alive && setMode(h.emailDelivery ?? null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return mode;
}
