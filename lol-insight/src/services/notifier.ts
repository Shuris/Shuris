import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { NoticeContent } from './notificationContent';

/**
 * Notificações LOCAIS (agendadas no próprio aparelho). Não usam servidor de
 * push: o app confere partidas novas quando é aberto ou atualizado, e o resumo
 * semanal e o lembrete de treino são agendados com os dados mais recentes.
 */
export const notificationsSupported = true;
const CHANNEL = 'lol-insight';
let configured = false;

function configure() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(CHANNEL, { name: 'LOL Insight', importance: Notifications.AndroidImportance.DEFAULT, lightColor: '#2F7DFF' }).catch(() => undefined);
  }
}

export async function permissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  configure();
  const p = await Notifications.getPermissionsAsync();
  return p.granted ? 'granted' : p.canAskAgain === false ? 'denied' : 'undetermined';
}

export async function requestPermission(): Promise<boolean> {
  configure();
  const p = await Notifications.requestPermissionsAsync();
  return p.granted;
}

const content = (n: NoticeContent): Notifications.NotificationContentInput => ({ title: n.title, body: n.body, data: { url: n.url } });

export async function notifyNow(n: NoticeContent): Promise<void> {
  configure();
  await Notifications.scheduleNotificationAsync({ content: content(n), trigger: Platform.OS === 'android' ? { channelId: CHANNEL, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 } : null });
}

/** Agenda (ou cancela, com `n = null`) uma notificação recorrente identificada por `id`. */
export async function scheduleWeekly(id: string, n: NoticeContent | null, weekday: number, hour: number, minute = 0): Promise<void> {
  configure();
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
  if (!n) return;
  await Notifications.scheduleNotificationAsync({ identifier: id, content: content(n), trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour, minute, channelId: CHANNEL } });
}

export async function scheduleDaily(id: string, n: NoticeContent | null, hour: number, minute = 0): Promise<void> {
  configure();
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
  if (!n) return;
  await Notifications.scheduleNotificationAsync({ identifier: id, content: content(n), trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL } });
}

/** Ao tocar numa notificação, abre a rota que ela carrega. */
export function onNotificationOpen(cb: (url: string) => void): () => void {
  configure();
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const url = r.notification.request.content.data?.url;
    if (typeof url === 'string') cb(url);
  });
  return () => sub.remove();
}
