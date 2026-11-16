import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Tokens de sessão devolvidos pelo backend. Nenhum segredo do servidor fica no app. */
export interface StoredSession {
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
}

const KEY = 'lolinsight.session.v1';

/**
 * Onde a sessão fica guardada:
 * - Android/iOS: expo-secure-store (Keystore do Android / Keychain do iOS), criptografado pelo sistema.
 * - Web: não existe armazenamento seguro equivalente no navegador; usa o armazenamento local da
 *   página. Por isso o token de acesso dura só 15 minutos e o de renovação troca a cada uso.
 */
const web = Platform.OS === 'web';

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = web ? await AsyncStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredSession) : null;
    return parsed?.refreshToken && parsed.refreshExpiresAt > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  const raw = JSON.stringify(session);
  try {
    if (web) await AsyncStorage.setItem(KEY, raw);
    else await SecureStore.setItemAsync(KEY, raw);
  } catch {
    // Sem persistência a sessão vale até o app fechar.
  }
}

export async function clearSession(): Promise<void> {
  try {
    if (web) await AsyncStorage.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignora
  }
}
