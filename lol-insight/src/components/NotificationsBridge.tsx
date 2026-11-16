import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { champion } from '@/data/champions';
import { goalNotice, matchNotice, trainingNotice, weeklyNotice } from '@/services/notificationContent';
import { loadNotificationPrefs, onNotificationPrefs, once, peek, type NotificationPrefs } from '@/services/notificationPrefs';
import { notificationsSupported, notifyNow, onNotificationOpen, scheduleDaily, scheduleWeekly } from '@/services/notifier';
import { useCoach } from '@/state/CoachContext';
import { usePlayer } from '@/state/PlayerContext';
import { buildMatchReport } from '@/stats/matchReport';
import { rankLabel } from '@/stats/rank';

/** Segunda-feira no calendário do expo-notifications (1 = domingo). */
const MONDAY = 2;

/**
 * Liga os dados do app às notificações locais: reagenda o resumo semanal e o
 * lembrete de treino com os números mais recentes, avisa quando aparece uma
 * partida nova (com o relatório) e quando a meta de elo está perto.
 * Não renderiza nada.
 */
export function NotificationsBridge() {
  const router = useRouter();
  const { data, dataSource } = usePlayer();
  const { report } = useCoach();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  useEffect(() => {
    if (!notificationsSupported) return;
    void loadNotificationPrefs().then(setPrefs);
    const offPrefs = onNotificationPrefs(setPrefs);
    const offOpen = onNotificationOpen((url) => router.push(url as never));
    return () => {
      offPrefs();
      offOpen();
    };
  }, [router]);

  // Agendamentos recorrentes
  useEffect(() => {
    if (!notificationsSupported || !prefs) return;
    void scheduleWeekly('weekly-summary', prefs.weekly && data ? weeklyNotice(data.matches, data.asOf) : null, MONDAY, 10).catch(() => undefined);
    void scheduleDaily('training-reminder', prefs.training ? trainingNotice(report) : null, prefs.trainingHour).catch(() => undefined);
  }, [prefs, data, report]);

  // Partida nova
  const latest = data?.matches[0];
  useEffect(() => {
    if (!notificationsSupported || !prefs || !data || !latest) return;
    const key = `match:${data.source}:${data.player.id}`;
    void (async () => {
      const prev = await peek(key);
      if (prev === latest.id) return;
      await once(key, latest.id);
      // Primeira vez vendo esta conta: só registra, não notifica partidas antigas.
      if (prev === null || !prefs.matchReport) return;
      let analysis = null;
      try {
        analysis = (await dataSource.loadMatchDetails(latest, data.player)).analysis ?? null;
      } catch {
        // Sem linha do tempo: o relatório sai só com o placar.
      }
      await notifyNow(matchNotice(latest, buildMatchReport(latest, analysis, data.player.rank?.tier), champion(latest.championId).name));
    })().catch(() => undefined);
  }, [prefs, data, latest, dataSource]);

  // Meta de elo
  useEffect(() => {
    if (!notificationsSupported || !prefs?.goal || !report?.goal || !data) return;
    const n = goalNotice(report);
    if (!n) return;
    const g = report.goal;
    void once(`goal:${data.player.id}:${rankLabel(g.target)}`, g.reached ? 'reached' : 'close')
      .then((fresh) => (fresh ? notifyNow(n) : undefined))
      .catch(() => undefined);
  }, [prefs, report, data]);

  return null;
}
