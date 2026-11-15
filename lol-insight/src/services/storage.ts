import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DataSourceKind, PlayerBundle } from '@/types';

import type { AccountSuggestion } from './PlayerDataSource';

/**
 * Persistência local (AsyncStorage). Tudo é separado por modo, para que contas
 * demonstrativas e reais nunca se misturem em buscas recentes ou cache.
 */
const key = (name: string, mode: DataSourceKind) => `lolinsight:${name}:${mode}`;
const MAX_CACHED_BUNDLES = 3;

async function read<T>(k: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function write(k: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(k, JSON.stringify(value));
  } catch {
    // Persistência é conveniência: o app funciona sem ela.
  }
}

export const loadLastAccount = (mode: DataSourceKind) => read<AccountSuggestion>(key('lastAccount', mode));
export const saveLastAccount = (mode: DataSourceKind, a: AccountSuggestion) => write(key('lastAccount', mode), a);
export const loadRecentSearches = async (mode: DataSourceKind) => (await read<AccountSuggestion[]>(key('recent', mode))) ?? [];
export const saveRecentSearches = (mode: DataSourceKind, list: AccountSuggestion[]) => write(key('recent', mode), list.slice(0, 5));

// ---- Cache local das contas reais -------------------------------------------
// Permite mostrar a última versão conhecida na hora, enquanto o servidor atualiza.

const accountId = (a: { gameName: string; tagLine?: string; region: string }) =>
  `${a.region}:${a.gameName.trim().toLowerCase()}#${(a.tagLine ?? '').trim().toLowerCase()}`;
const bundleKey = (id: string) => `lolinsight:bundle:${id}`;
const INDEX = 'lolinsight:bundle:index';

export async function loadCachedBundle(a: { gameName: string; tagLine?: string; region: string }): Promise<PlayerBundle | null> {
  return read<PlayerBundle>(bundleKey(accountId(a)));
}

export async function saveCachedBundle(bundle: PlayerBundle): Promise<void> {
  if (bundle.source !== 'riot') return;
  const id = accountId(bundle.player);
  await write(bundleKey(id), bundle);
  const index = [id, ...((await read<string[]>(INDEX)) ?? []).filter((x) => x !== id)];
  for (const old of index.slice(MAX_CACHED_BUNDLES)) {
    try {
      await AsyncStorage.removeItem(bundleKey(old));
    } catch {
      // ignora
    }
  }
  await write(INDEX, index.slice(0, MAX_CACHED_BUNDLES));
}
