import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Field, FormError, FormNotice, StatusBadge } from '@/components/auth/Form';
import { REGIONS } from '@/components/SearchBar';
import { Card, Chip, ChipRow, EmptyState, Screen, SectionHeader } from '@/components/ui';
import { parseRiotId, ServiceError } from '@/services';
import type { RiotAccount } from '@/services/authApi';
import { dateShort } from '@/stats/format';
import { colors, fonts, radius, space, type } from '@/theme';
import type { Region } from '@/types';

import { useRequireAuth } from './useRequireAuth';

const asError = (e: unknown) => (e instanceof ServiceError ? e : new ServiceError('UNKNOWN', 'Não foi possível concluir.'));

export function RiotLinkScreen() {
  const auth = useRequireAuth();
  const router = useRouter();
  const [riotId, setRiotId] = useState('');
  const [region, setRegion] = useState<Region>(auth.settings?.preferredRegion ?? 'BR');
  const [error, setError] = useState<ServiceError | null>(null);
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState<RiotAccount | null>(null);
  const [rowError, setRowError] = useState<ServiceError | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const parsed = parseRiotId(riotId);
  const valid = !!parsed.gameName && !!parsed.tagLine;
  const verified = auth.user?.emailVerified;

  const link = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    setLinked(null);
    try {
      setLinked(await auth.linkRiot({ gameName: parsed.gameName, tagLine: parsed.tagLine!, region }));
      setRiotId('');
    } catch (e) {
      setError(asError(e));
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn: () => Promise<void>) => {
    setRowError(null);
    try {
      await fn();
    } catch (e) {
      setRowError(asError(e));
    }
  };

  return (
    <Screen title="Contas Riot" subtitle="Vinculação ao seu perfil" back>
      <Card>
        <SectionHeader title="Contas vinculadas" subtitle="A principal é usada pela Academy e pela previsão de elo" />
        {auth.riotAccounts.length ? (
          <View style={{ gap: space.sm }}>
            {auth.riotAccounts.map((a) => (
              <View key={a.id} style={[styles.account, a.isPrimary && { borderColor: 'rgba(92,155,255,0.5)' }]}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={type.h3}>
                    {a.gameName}
                    <Text style={{ color: colors.textMuted }}> #{a.tagLine}</Text> · {a.region}
                  </Text>
                  <View style={styles.badges}>
                    {a.isPrimary ? <StatusBadge label="PRINCIPAL" tone="success" /> : null}
                    <StatusBadge label={a.verificationStatus === 'rso_verified' ? 'VERIFICADA (RSO)' : 'NÃO VERIFICADA'} tone={a.verificationStatus === 'rso_verified' ? 'success' : 'neutral'} />
                  </View>
                  <Text style={type.bodySm}>Vinculada em {dateShort(a.linkedAt)}</Text>
                </View>
                <View style={{ gap: 6, alignItems: 'flex-end' }}>
                  {!a.isPrimary ? (
                    <Pressable onPress={() => void act(() => auth.setPrimaryRiot(a.id))} hitSlop={6} accessibilityRole="button">
                      <Text style={styles.action}>Tornar principal</Text>
                    </Pressable>
                  ) : null}
                  {confirmRemove === a.id ? (
                    <Pressable onPress={() => void act(async () => (await auth.unlinkRiot(a.id), setConfirmRemove(null)))} hitSlop={6} accessibilityRole="button">
                      <Text style={[styles.action, { color: colors.loss }]}>Confirmar remoção</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => setConfirmRemove(a.id)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Remover ${a.gameName}`}>
                      <Text style={[styles.action, { color: colors.textMuted }]}>Remover</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState icon="link-outline" title="Nenhuma conta vinculada" message="Vincule sua conta Riot abaixo." />
        )}
        <View style={{ marginTop: space.md }}>
          <FormError error={rowError} />
        </View>
      </Card>

      <Card>
        <SectionHeader title="Vincular pelo Riot ID" subtitle="Cria um perfil não verificado" />
        {!verified ? (
          <View style={{ gap: space.md }}>
            <FormNotice tone="warning" icon="mail-unread-outline">Confirme seu e-mail antes de vincular uma conta Riot.</FormNotice>
            <Button label="Confirmar e-mail" onPress={() => router.push('/verificar-email')} />
          </View>
        ) : (
          <View style={{ gap: space.lg }}>
            <Field label="Riot ID" icon="person-outline" value={riotId} onChangeText={setRiotId} placeholder="Nome#TAG" error={riotId && !valid ? 'Use o formato Nome#TAG.' : null} onSubmitEditing={link} />
            <View>
              <Text style={[type.label, { marginBottom: 8 }]}>Região</Text>
              <ChipRow>
                {REGIONS.map((r) => (
                  <Chip key={r.value} label={r.value} active={region === r.value} onPress={() => setRegion(r.value)} />
                ))}
              </ChipRow>
            </View>
            <FormError error={error} />
            {linked ? (
              <FormNotice tone="success" icon="checkmark-circle-outline">
                {linked.gameName}#{linked.tagLine} vinculada{linked.isPrimary ? ' como conta principal' : ''}. As partidas estão sendo carregadas.
              </FormNotice>
            ) : null}
            <Button label="Vincular conta" icon="link-outline" onPress={link} loading={busy} disabled={!valid} />
          </View>
        )}
        <Text style={[type.bodySm, { marginTop: space.lg }]}>
          O LOL Insight nunca pede a senha da sua conta Riot. Sem a verificação oficial, qualquer pessoa pode vincular um Riot ID público; por isso o perfil aparece como não verificado.
        </Text>
      </Card>

      <Card style={{ opacity: auth.rso?.available ? 1 : 0.85 }}>
        <View style={styles.rsoHead}>
          <Ionicons name="shield-checkmark-outline" size={20} color={auth.rso?.available ? colors.good : colors.textMuted} />
          <Text style={[type.h3, { flex: 1 }]}>Verificação oficial (Riot Sign On)</Text>
          <StatusBadge label={auth.rso?.available ? 'DISPONÍVEL' : 'INDISPONÍVEL'} tone={auth.rso?.available ? 'success' : 'neutral'} />
        </View>
        <Text style={[type.bodySm, { marginTop: 6 }]}>{auth.rso?.reason ?? 'Depende de aprovação da Riot Games.'}</Text>
        <View style={{ marginTop: space.md }}>
          <Button label="Verificar com a Riot" variant="secondary" icon="shield-checkmark-outline" onPress={() => undefined} disabled />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  account: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  action: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.accentSoft },
  rsoHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
