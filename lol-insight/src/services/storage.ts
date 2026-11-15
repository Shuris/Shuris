import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AccountSuggestion } from './PlayerDataSource';

const KEY_LAST = 'lolinsight:lastAccount';
const KEY_RECENT = 'lolinsight:recentSearches';

async function read<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Persistência é conveniência: o app funciona sem ela.
  }
}

export const loadLastAccount = () => read<AccountSuggestion>(KEY_LAST);
export const saveLastAccount = (a: AccountSuggestion) => write(KEY_LAST, a);
export const loadRecentSearches = async () => (await read<AccountSuggestion[]>(KEY_RECENT)) ?? [];
export const saveRecentSearches = (list: AccountSuggestion[]) => write(KEY_RECENT, list.slice(0, 5));
