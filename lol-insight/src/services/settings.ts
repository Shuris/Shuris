import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { DataSourceKind } from '@/types';

import { MATCH_COUNTS, type MatchCount } from './PlayerDataSource';

const KEY = 'lolinsight:settings:v2';
export const SERVER_PORT = 3333;

export interface Settings {
  /** Demonstração (dados fictícios) ou dados reais da Riot. */
  mode: DataSourceKind;
  /** Endereço do backend informado pelo usuário; vazio = detecção automática. */
  serverUrl: string;
  matchCount: MatchCount;
}

/**
 * Endereço padrão do backend.
 * 1. EXPO_PUBLIC_API_BASE_URL, se definido.
 * 2. Em desenvolvimento (Expo Go), o mesmo computador que serve o app: o IP
 *    vem do endereço do Metro, então o celular acha o servidor sem configuração.
 * 3. No navegador, o próprio host da página.
 */
export function defaultServerUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];
  // Em modo túnel o host é um domínio do Expo, que não alcança o servidor local.
  if (host && !/exp\.direct|expo\.dev|ngrok/.test(host)) return `http://${host}:${SERVER_PORT}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:${SERVER_PORT}`;
  }
  return `http://localhost:${SERVER_PORT}`;
}

export function defaultSettings(): Settings {
  return { mode: process.env.EXPO_PUBLIC_DATA_SOURCE === 'riot' ? 'riot' : 'demo', serverUrl: '', matchCount: 20 };
}

export const effectiveServerUrl = (s: Settings) => (s.serverUrl.trim() || defaultServerUrl()).replace(/\/+$/, '');

export async function loadSettings(): Promise<Settings> {
  const base = defaultSettings();
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<Settings>;
    return {
      mode: saved.mode === 'riot' || saved.mode === 'demo' ? saved.mode : base.mode,
      serverUrl: typeof saved.serverUrl === 'string' ? saved.serverUrl : '',
      matchCount: MATCH_COUNTS.includes(saved.matchCount as MatchCount) ? (saved.matchCount as MatchCount) : base.matchCount,
    };
  } catch {
    return base;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Preferências são conveniência: o app funciona sem persistência.
  }
}
