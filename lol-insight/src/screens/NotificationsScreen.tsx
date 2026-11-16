import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Card, haptic, Screen, SectionHeader, Segmented } from '@/components/ui';
import { goalNotice, trainingNotice, weeklyNotice } from '@/services/notificationContent';
import { DEFAULT_NOTIFICATION_PREFS, loadNotificationPrefs, saveNotificationPrefs, type NotificationPrefs } from '@/services/notificationPrefs';
import { notificationsSupported, notifyNow, permissionStatus, requestPermission } from '@/services/notifier';
import { useCoach } from '@/state/CoachContext';
import { usePlayer } from '@/state/PlayerContext';
import { colors, fonts, radius, space, type } from '@/theme';

type ToggleKey = 'matchReport' | 'weekly' | 'training' | 'goal';

const OPTIONS: Array<{ key: ToggleKey; icon: keyof typeof Ionicons.glyphMap; title: string; detail: string }> = [
  { key: 'matchReport', icon: 'sparkles-outline', title: 'Relatório de partida nova', detail: 'Quando o app encontra uma partida nova, avisa com o ponto principal do relatório.' },
  { key: 'weekly', icon: 'calendar-outline', title: 'Resumo semanal', detail: 'Segunda-feira às 10h: partidas, vitórias e LP da semana.' },
  { key: 'training', icon: 'school-outline', title: 'Lembrete do plano de treino', detail: 'Todo dia, no horário escolhido, com a próxima aula da LOI Academy.' },
  { key: 'goal', icon: 'flag-outline', title: 'Meta de elo próxima', detail: 'Quando faltarem 30 LP ou menos para a sua meta, e quando ela for alcançada.' },
];

export function NotificationsScreen() {
  const { data } = usePlayer();
  const { report } = useCoach();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [perm, setPerm] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void loadNotificationPrefs().then(setPrefs);
    void permissionStatus().then(setPerm);
  }, []);

  const update = async (next: NotificationPrefs) => {
    setMsg(null);
    const turningOn = (Object.keys(next) as Array<keyof NotificationPrefs>).some((k) => typeof next[k] === 'boolean' && next[k] && !prefs[k]);
    if (turningOn && perm !== 'granted') {
      const ok = await requestPermission();
      setPerm(ok ? 'granted' : 'denied');
      if (!ok) {
        setMsg('Permissão negada. Ative as notificações do LOL Insight nas configurações do Android.');
        return;
      }
    }
    haptic.select();
    setPrefs(next);
    await saveNotificationPrefs(next);
  };

  const test = async () => {
    const n = (prefs.training && trainingNotice(report)) || (data && weeklyNotice(data.matches, data.asOf)) || goalNotice(report) || { title: 'LOL Insight', body: 'As notificações estão funcionando.', url: '/' };
    if (perm !== 'granted' && !(await requestPermission())) return setMsg('Sem permissão para notificar.');
    setPerm('granted');
    await notifyNow(n);
    setMsg('Notificação de teste enviada.');
  };

  if (!notificationsSupported) {
    return (
      <Screen title="Notificações" back>
        <Card>
          <View style={styles.webNote}>
            <Ionicons name="phone-portrait-outline" size={22} color={colors.accentSoft} />
            <Text style={[type.body, { flex: 1 }]}>As notificações funcionam no aplicativo Android. No navegador elas não estão disponíveis.</Text>
          </View>
        </Card>
        <Preview />
      </Screen>
    );
  }

  return (
    <Screen title="Notificações" subtitle={perm === 'granted' ? 'Permitidas neste aparelho' : perm === 'denied' ? 'Bloqueadas nas configurações do sistema' : 'Escolha o que quer receber'} back>
      <Card>
        <SectionHeader title="O que avisar" subtitle="Tudo começa desligado. As preferências ficam só neste aparelho." />
        <View style={{ gap: space.sm }}>
          {OPTIONS.map((o) => (
            <View key={o.key} style={styles.row}>
              <Ionicons name={o.icon} size={20} color={colors.gold} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.h3}>{o.title}</Text>
                <Text style={type.bodySm}>{o.detail}</Text>
              </View>
              <Switch
                value={prefs[o.key]}
                onValueChange={(v) => void update({ ...prefs, [o.key]: v })}
                trackColor={{ false: colors.surfaceHigh, true: colors.accent }}
                thumbColor="#fff"
                accessibilityLabel={o.title}
              />
            </View>
          ))}
        </View>
        {prefs.training ? (
          <View style={{ marginTop: space.lg, gap: space.sm }}>
            <Text style={type.label}>Horário do lembrete de treino</Text>
            <Segmented options={[8, 12, 19, 21].map((h) => ({ value: h, label: `${h}h` }))} value={prefs.trainingHour} onChange={(h) => void update({ ...prefs, trainingHour: h })} />
          </View>
        ) : null}
        {msg ? <Text style={[type.bodySm, { marginTop: space.md, color: msg.startsWith('Notificação') ? colors.good : colors.loss }]}>{msg}</Text> : null}
        <Pressable onPress={() => void test()} style={styles.test} accessibilityRole="button" accessibilityLabel="Enviar notificação de teste">
          <Ionicons name="notifications-outline" size={16} color={colors.accentSoft} />
          <Text style={styles.testText}>Enviar notificação de teste</Text>
        </Pressable>
      </Card>
      <Preview />
    </Screen>
  );
}

/** Como as mensagens vão aparecer, com os dados atuais. */
function Preview() {
  const { data } = usePlayer();
  const { report } = useCoach();
  const items = [data ? weeklyNotice(data.matches, data.asOf) : null, trainingNotice(report), goalNotice(report)].filter(Boolean) as Array<{ title: string; body: string }>;
  if (!items.length) return null;
  return (
    <Card>
      <SectionHeader title="Prévia" subtitle="Com os seus dados de agora" />
      <View style={{ gap: space.sm }}>
        {items.map((n) => (
          <View key={n.title} style={styles.bubble}>
            <View style={styles.bubbleIcon}>
              <Ionicons name="diamond" size={12} color={colors.accentSoft} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.h3, { fontSize: 13 }]}>{n.title}</Text>
              <Text style={[type.bodySm, { color: colors.textSecondary }]}>{n.body}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={[type.bodySm, { marginTop: space.md }]}>
        As notificações são locais: o app confere partidas novas quando é aberto ou atualizado. Avisos com o app totalmente fechado exigiriam um servidor de push (serviço externo).
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md },
  test: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.lg, alignSelf: 'flex-start' },
  testText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.accentSoft },
  webNote: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  bubble: { flexDirection: 'row', gap: space.md, backgroundColor: colors.surfaceHigh, borderRadius: radius.lg, padding: space.md },
  bubbleIcon: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#0B1220', borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
});
