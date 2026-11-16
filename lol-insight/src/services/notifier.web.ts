import type { NoticeContent } from './notificationContent';

/** No navegador as notificações agendadas não estão disponíveis: tudo vira operação vazia. */
export const notificationsSupported = false;
export async function permissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  return 'denied';
}
export async function requestPermission(): Promise<boolean> {
  return false;
}
export async function notifyNow(_n: NoticeContent): Promise<void> {}
export async function scheduleWeekly(_id: string, _n: NoticeContent | null, _weekday: number, _hour: number, _minute = 0): Promise<void> {}
export async function scheduleDaily(_id: string, _n: NoticeContent | null, _hour: number, _minute = 0): Promise<void> {}
export function onNotificationOpen(_cb: (url: string) => void): () => void {
  return () => undefined;
}
