import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ServiceError } from '@/services';
import { api } from '@/services/apiClient';
import { authApi, type MeResponse, type RiotAccount, type RsoStatus, type User, type UserSettings } from '@/services/authApi';
import { effectiveServerUrl, loadSettings } from '@/services/settings';
import { clearRealModeData } from '@/services/storage';
import type { Region } from '@/types';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'unreachable';

interface AuthValue {
  status: AuthStatus;
  user: User | null;
  riotAccounts: RiotAccount[];
  primary: RiotAccount | null;
  settings: UserSettings | null;
  rso: RsoStatus | null;
  /** true quando o servidor está em modo pessoal e o app usa o usuário local, sem conta. */
  personal: boolean;
  register: (input: { username: string; email: string; password: string }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  /** Recarrega o perfil do servidor (ex.: depois de trocar o endereço do servidor). */
  reload: () => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  saveSettings: (s: Partial<Pick<UserSettings, 'matchCount' | 'preferredRegion'>>) => Promise<void>;
  linkRiot: (input: { gameName: string; tagLine: string; region: Region }) => Promise<RiotAccount>;
  setPrimaryRiot: (id: string) => Promise<void>;
  unlinkRiot: (id: string) => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);
const LAST_USER_KEY = 'lolinsight:lastUserId';

/**
 * Estado da conta do usuário. O app guarda só os tokens de sessão (armazenamento
 * seguro do aparelho); perfil, contas Riot e configurações vêm sempre do servidor,
 * que é quem valida cada permissão.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [personal, setPersonal] = useState(false);
  const loadingRef = useRef(false);

  const fetchMe = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const session = await api.restore();
      if (!session) {
        // Sem conta: se o servidor estiver em modo pessoal, usa o usuário local.
        const health = await api.request<{ personalMode?: boolean }>('/health', { auth: false, timeoutMs: 6000 }).catch(() => null);
        if (health?.personalMode) {
          setMe(await authApi.me());
          setPersonal(true);
          setStatus('signedIn');
          return;
        }
        setPersonal(false);
        setMe(null);
        setStatus('signedOut');
        return;
      }
      const data = await authApi.me();
      setPersonal(false);
      setMe(data);
      setStatus('signedIn');
    } catch (e) {
      if (e instanceof ServiceError && e.code === 'SERVER_UNREACHABLE' && api.hasSession()) setStatus('unreachable');
      else {
        setMe(null);
        setStatus('signedOut');
      }
    } finally {
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void (async () => {
      api.setBaseUrl(effectiveServerUrl(await loadSettings()));
      await fetchMe();
    })();
    // Sessão recusada pelo servidor (expirada, revogada em outro aparelho, senha trocada): volta ao estado deslogado.
    return api.onSessionChange(() => {
      if (!api.hasSession()) {
        setMe(null);
        setStatus('signedOut');
        // Saiu da conta: no modo pessoal, volta para o usuário local.
        void fetchMe();
      }
    });
  }, [fetchMe]);

  /** Ao trocar de usuário no mesmo aparelho, apaga o histórico local do modo real do usuário anterior. */
  const startSession = useCallback(async (res: { user: User; session: Parameters<typeof api.setSession>[0] }) => {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const last = await AsyncStorage.getItem(LAST_USER_KEY).catch(() => null);
    if (last && last !== res.user.id) await clearRealModeData();
    await AsyncStorage.setItem(LAST_USER_KEY, res.user.id).catch(() => undefined);
    await api.setSession(res.session);
    setStatus('loading');
    await fetchMe();
  }, [fetchMe]);

  const value = useMemo<AuthValue>(() => {
    const riotAccounts = me?.riotAccounts ?? [];
    const patch = (p: Partial<MeResponse>) => setMe((prev) => (prev ? { ...prev, ...p } : prev));
    return {
      status,
      user: me?.user ?? null,
      riotAccounts,
      primary: riotAccounts.find((a) => a.isPrimary) ?? null,
      settings: me?.settings ?? null,
      rso: me?.rso ?? null,
      personal,
      register: async (input) => startSession(await authApi.register(input)),
      login: async (input) => startSession(await authApi.login(input)),
      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // Mesmo sem resposta do servidor, a sessão local é descartada.
        }
        await clearRealModeData();
        await api.setSession(null);
      },
      reload: fetchMe,
      verifyEmail: async (code) => patch({ user: (await authApi.verifyEmail(code)).user }),
      resendVerification: async () => void (await authApi.resendVerification()),
      changePassword: async (current, next) => void (await authApi.changePassword(current, next)),
      deleteAccount: async (password) => {
        await authApi.deleteAccount(password);
        await clearRealModeData();
        await api.setSession(null);
      },
      saveSettings: async (s) => patch({ settings: (await authApi.saveSettings(s)).settings }),
      linkRiot: async (input) => {
        const { riotAccount } = await authApi.linkRiot(input);
        await fetchMe();
        return riotAccount;
      },
      setPrimaryRiot: async (id) => patch({ riotAccounts: (await authApi.setPrimaryRiot(id)).riotAccounts }),
      unlinkRiot: async (id) => patch({ riotAccounts: (await authApi.unlinkRiot(id)).riotAccounts }),
    };
  }, [status, me, fetchMe, startSession, personal]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
