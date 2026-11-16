import type { Region } from '@/types';

import { api } from './apiClient';
import type { StoredSession } from './sessionStore';

export interface User {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  createdAt: number;
}

export interface RiotAccount {
  id: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  region: Region;
  verificationStatus: 'unverified' | 'rso_verified';
  isPrimary: boolean;
  linkedAt: number;
  verifiedAt: number | null;
}

export interface UserSettings {
  matchCount: 10 | 20 | 50 | 100;
  preferredRegion: Region | null;
  updatedAt: number;
}

export interface RsoStatus {
  available: boolean;
  reason: string;
}

export interface MeResponse {
  user: User;
  riotAccounts: RiotAccount[];
  settings: UserSettings;
  rso: RsoStatus;
}

export interface SessionInfo {
  id: string;
  client: string;
  ip: string;
  createdAt: number;
  lastUsedAt: number;
  current: boolean;
}

interface AuthResponse {
  user: User;
  session: StoredSession;
}

/** Chamadas de conta ao backend. Toda regra de segurança é validada no servidor. */
export const authApi = {
  register: (input: { username: string; email: string; password: string }) => api.request<AuthResponse>('/v1/auth/register', { method: 'POST', body: input, auth: false }),
  login: (input: { email: string; password: string }) => api.request<AuthResponse>('/v1/auth/login', { method: 'POST', body: input, auth: false }),
  logout: () => api.request<{ ok: true }>('/v1/auth/logout', { method: 'POST', body: {} }),
  forgot: (email: string) => api.request<{ ok: true; message: string }>('/v1/auth/password/forgot', { method: 'POST', body: { email }, auth: false }),
  reset: (input: { email: string; code: string; password: string }) => api.request<{ ok: true }>('/v1/auth/password/reset', { method: 'POST', body: input, auth: false }),

  me: () => api.request<MeResponse>('/v1/me'),
  verifyEmail: (code: string) => api.request<{ user: User }>('/v1/me/email/verify', { method: 'POST', body: { code } }),
  resendVerification: () => api.request<{ ok: true }>('/v1/me/email/resend', { method: 'POST', body: {} }),
  changePassword: (currentPassword: string, newPassword: string) => api.request<{ ok: true }>('/v1/me/password', { method: 'POST', body: { currentPassword, newPassword } }),
  deleteAccount: (password: string) => api.request<{ ok: true }>('/v1/me/delete', { method: 'POST', body: { password } }),
  saveSettings: (s: Partial<Pick<UserSettings, 'matchCount' | 'preferredRegion'>>) => api.request<{ settings: UserSettings }>('/v1/me/settings', { method: 'POST', body: s }),

  sessions: () => api.request<{ sessions: SessionInfo[] }>('/v1/me/sessions'),
  revokeSession: (id: string) => api.request<{ ok: true }>(`/v1/me/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  revokeOtherSessions: () => api.request<{ revoked: number }>('/v1/me/sessions/revoke-others', { method: 'POST', body: {} }),

  linkRiot: (input: { gameName: string; tagLine: string; region: Region }) => api.request<{ riotAccount: RiotAccount }>('/v1/me/riot-accounts', { method: 'POST', body: input, timeoutMs: 30_000 }),
  setPrimaryRiot: (id: string) => api.request<{ riotAccounts: RiotAccount[] }>(`/v1/me/riot-accounts/${encodeURIComponent(id)}/primary`, { method: 'POST', body: {} }),
  unlinkRiot: (id: string) => api.request<{ riotAccounts: RiotAccount[] }>(`/v1/me/riot-accounts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
