import AsyncStorage from '@react-native-async-storage/async-storage';

/** Preferências de notificação (ficam só no aparelho). Tudo começa desligado: o usuário escolhe. */
export interface NotificationPrefs {
  matchReport: boolean;
  weekly: boolean;
  training: boolean;
  goal: boolean;
  /** Hora do lembrete de treino (0–23). */
  trainingHour: number;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = { matchReport: false, weekly: false, training: false, goal: false, trainingHour: 19 };
const KEY = 'lolinsight:notificationPrefs.v1';
const listeners = new Set<(p: NotificationPrefs) => void>();

export async function loadNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_NOTIFICATION_PREFS, ...(JSON.parse(raw) as Partial<NotificationPrefs>) } : DEFAULT_NOTIFICATION_PREFS;
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

export async function saveNotificationPrefs(p: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => undefined);
  listeners.forEach((l) => l(p));
}

export function onNotificationPrefs(l: (p: NotificationPrefs) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Evita repetir a mesma notificação (ex.: a mesma partida, a mesma meta no mesmo dia). */
export async function once(key: string, value: string): Promise<boolean> {
  const k = `lolinsight:notified:${key}`;
  try {
    if ((await AsyncStorage.getItem(k)) === value) return false;
    await AsyncStorage.setItem(k, value);
    return true;
  } catch {
    return false;
  }
}

export async function peek(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(`lolinsight:notified:${key}`);
  } catch {
    return null;
  }
}
