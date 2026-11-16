import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, FormError, FormNotice, StatusBadge } from '@/components/auth/Form';
import { Card, Screen, ScreenSkeleton, SectionHeader } from '@/components/ui';
import { ServiceError } from '@/services';
import { authApi, type SessionInfo } from '@/services/authApi';
import { ago, dateTime } from '@/stats/format';
import { colors, radius, space, type } from '@/theme';

import { useRequireAuth } from './useRequireAuth';

export function SessionsScreen() {
  const auth = useRequireAuth();
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [error, setError] = useState<ServiceError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSessions((await authApi.sessions()).sessions);
    } catch (e) {
      setError(e instanceof ServiceError ? e : new ServiceError('UNKNOWN', 'Não foi possível carregar as sessões.'));
    }
  }, []);
  useEffect(() => {
    if (auth.status === 'signedIn') void load();
  }, [auth.status, load]);

  const run = async (id: string, fn: () => Promise<string>) => {
    setBusy(id);
    setError(null);
    setNotice(null);
    try {
      setNotice(await fn());
      await load();
    } catch (e) {
      setError(e instanceof ServiceError ? e : new ServiceError('UNKNOWN', 'Não foi possível concluir.'));
    } finally {
      setBusy(null);
    }
  };

  const others = sessions?.filter((s) => !s.current).length ?? 0;
  return (
    <Screen title="Sessões" subtitle="Aparelhos conectados à sua conta" back>
      {!sessions ? (
        error ? <FormError error={error} /> : <ScreenSkeleton hero={false} cards={2} />
      ) : (
        <>
          <Card>
            <SectionHeader title={`${sessions.length} ${sessions.length === 1 ? 'sessão ativa' : 'sessões ativas'}`} subtitle="Sessões expiram após 30 dias sem uso" />
            <View style={{ gap: space.sm }}>
              {sessions.map((s) => (
                <View key={s.id} style={[styles.session, s.current && { borderColor: 'rgba(47,179,128,0.45)' }]}>
                  <Ionicons name={/Android|iOS/.test(s.client) ? 'phone-portrait-outline' : 'desktop-outline'} size={20} color={colors.accentSoft} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={type.h3}>{s.client}</Text>
                    <Text style={type.bodySm}>
                      Último uso {ago(s.lastUsedAt)} · IP {s.ip}
                    </Text>
                    <Text style={type.bodySm}>Desde {dateTime(s.createdAt)}</Text>
                    {s.current ? <StatusBadge label="ESTE APARELHO" tone="success" /> : null}
                  </View>
                  {!s.current ? (
                    <Button label="Encerrar" variant="secondary" loading={busy === s.id} onPress={() => void run(s.id, async () => (await authApi.revokeSession(s.id), 'Sessão encerrada.'))} />
                  ) : null}
                </View>
              ))}
            </View>
          </Card>
          <FormError error={error} />
          {notice ? <FormNotice tone="success" icon="checkmark-circle-outline">{notice}</FormNotice> : null}
          {others > 0 ? (
            <Button
              label="Encerrar todas as outras sessões"
              variant="danger"
              icon="log-out-outline"
              loading={busy === 'all'}
              onPress={() => void run('all', async () => `${(await authApi.revokeOtherSessions()).revoked} sessões encerradas.`)}
            />
          ) : null}
          <Text style={[type.bodySm, { textAlign: 'center' }]}>Viu um aparelho que não reconhece? Encerre a sessão e altere sua senha em Configurações da conta.</Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  session: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
});
