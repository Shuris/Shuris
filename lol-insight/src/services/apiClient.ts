import { Platform } from 'react-native';

import type { Region } from '@/types';

import { ServiceError, type ServiceErrorCode } from './errors';
import { clearSession, loadSession, saveSession, type StoredSession } from './sessionStore';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  /** false = rota pública (não envia o token). */
  auth?: boolean;
  timeoutMs?: number;
}

type Listener = () => void;

const CLIENT = `${Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iOS' : 'Navegador'} · LOL Insight`;

/**
 * Cliente HTTP do backend do LOL Insight.
 * - Envia o token de acesso em `Authorization: Bearer`.
 * - Quando o servidor responde TOKEN_EXPIRED, renova a sessão uma única vez
 *   (pedidos simultâneos esperam a mesma renovação) e repete o pedido.
 * - Se a renovação falhar, apaga a sessão local e avisa os ouvintes (o app volta ao login).
 */
class ApiClient {
  private baseUrl = '';
  private session: StoredSession | null = null;
  private loaded = false;
  private refreshing: Promise<boolean> | null = null;
  private listeners = new Set<Listener>();

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  onSessionChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  async restore(): Promise<StoredSession | null> {
    if (!this.loaded) {
      this.session = await loadSession();
      this.loaded = true;
    }
    return this.session;
  }

  hasSession() {
    return !!this.session;
  }

  async setSession(session: StoredSession | null) {
    this.session = session;
    this.loaded = true;
    if (session) await saveSession(session);
    else await clearSession();
    this.emit();
  }

  private async refresh(): Promise<boolean> {
    if (!this.session) return false;
    this.refreshing ??= (async () => {
      try {
        const res = await this.raw<{ session: StoredSession }>('/v1/auth/refresh', { method: 'POST', body: { refreshToken: this.session!.refreshToken }, auth: false });
        this.session = res.session;
        await saveSession(res.session);
        return true;
      } catch (e) {
        // Só descarta a sessão se o servidor a recusou; sem rede, mantém para tentar depois.
        if (e instanceof ServiceError && e.code !== 'SERVER_UNREACHABLE') await this.setSession(null);
        return false;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (options.auth !== false) await this.restore();
    try {
      return await this.raw<T>(path, options);
    } catch (e) {
      if (options.auth !== false && e instanceof ServiceError && e.code === 'TOKEN_EXPIRED' && (await this.refresh())) {
        return this.raw<T>(path, options);
      }
      if (options.auth !== false && e instanceof ServiceError && e.code === 'AUTH_REQUIRED' && this.session) await this.setSession(null);
      throw e;
    }
  }

  private async raw<T>(path: string, options: RequestOptions): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Client': CLIENT };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.auth !== false && this.session) headers.Authorization = `Bearer ${this.session.accessToken}`;
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        signal: controller.signal,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch {
      throw new ServiceError('SERVER_UNREACHABLE', `Não foi possível conectar ao servidor em ${this.baseUrl}.`);
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
      throw new ServiceError(err.code as ServiceErrorCode, err.message ?? 'Erro ao consultar o servidor.', { retryAfterSec: err.retryAfterSec, suggestedRegion: err.suggestedRegion });
    }
    throw new ServiceError('SERVER_UNREACHABLE', `O endereço ${this.baseUrl} respondeu, mas não parece ser o servidor do LOL Insight (HTTP ${res.status}).`);
  }
}

export const api = new ApiClient();
