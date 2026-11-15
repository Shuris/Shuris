import type { Region } from '@/types';

import { ServiceError, type ServiceErrorCode } from './errors';

interface RequestInit2 {
  method?: 'GET' | 'POST';
  body?: unknown;
  timeoutMs?: number;
}

/**
 * Chamada JSON ao backend do LOL Insight. Converte qualquer falha em
 * ServiceError com o código informado pelo servidor (ou SERVER_UNREACHABLE).
 */
export async function requestJson<T>(baseUrl: string, path: string, init: RequestInit2 = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 20_000);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? 'GET',
      signal: controller.signal,
      headers: init.body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ServiceError('SERVER_UNREACHABLE', `Não foi possível conectar ao servidor em ${baseUrl}.`);
  } finally {
    clearTimeout(timer);
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Resposta sem JSON: tratada abaixo pelo status.
  }
  if (res.ok && body) return body as T;

  const err = (body as { error?: { code?: string; message?: string; retryAfterSec?: number; suggestedRegion?: Region } } | null)?.error;
  if (err?.code) {
    throw new ServiceError(err.code as ServiceErrorCode, err.message ?? 'Erro ao consultar o servidor.', {
      retryAfterSec: err.retryAfterSec,
      suggestedRegion: err.suggestedRegion,
    });
  }
  throw new ServiceError('SERVER_UNREACHABLE', `O endereço ${baseUrl} respondeu, mas não parece ser o servidor do LOL Insight (HTTP ${res.status}).`);
}
