import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, FormNotice, StatusBadge } from '@/components/auth/Form';
import { Card, RankEmblem, Screen, ScreenSkeleton, SectionHeader } from '@/components/ui';
import { usePlayer } from '@/state/PlayerContext';
import { dateShort } from '@/stats/format';
import { rankLabel, TIER_COLOR } from '@/stats/rank';
import { colors, fonts, radius, space, type } from '@/theme';

import { useRequireAuth } from './useRequireAuth';

type IconName = keyof typeof Ionicons.glyphMap;

/** Perfil individual do usuário: identidade, conta Riot vinculada e atalhos da conta. */
export function AccountScreen() {
  const auth = useRequireAuth();
  const { data } = usePlayer();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  if (auth.status !== 'signedIn' || !auth.user) {
    return (
      <Screen title="Minha conta" back>
        <ScreenSkeleton cards={2} />
      </Screen>
    );
  }
  const user = auth.user;
  const primary = auth.primary;
  const showingPrimary = !!primary && data?.source === 'riot' && data.player.puuid === primary.puuid;

  const logout = async () => {
    setLeaving(true);
    await auth.logout();
    router.replace('/perfil');
  };

  return (
    <Screen title="Minha conta" subtitle="Perfil individual" back>
      <Card>
        <View style={styles.head}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.username[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={type.h1} numberOfLines={1}>
              {user.username}
            </Text>
            <Text style={type.bodySm} numberOfLines={1}>
              {user.email}
            </Text>
            <StatusBadge label={user.emailVerified ? 'E-MAIL CONFIRMADO' : 'E-MAIL NÃO CONFIRMADO'} tone={user.emailVerified ? 'success' : 'warning'} />
          </View>
        </View>
        <View style={styles.meta}>
          <Meta label="Membro desde" value={dateShort(user.createdAt)} />
          <Meta label="ID da conta" value={user.id.slice(0, 12) + '…'} />
        </View>
      </Card>

      {!user.emailVerified ? (
        <Card style={{ borderColor: 'rgba(217,164,65,0.5)' }}>
          <Text style={type.h3}>Confirme seu e-mail</Text>
          <Text style={[type.bodySm, { marginTop: 4 }]}>É necessário para vincular uma conta Riot e garante que você consiga recuperar a senha.</Text>
          <View style={{ marginTop: space.md }}>
            <Button label="Confirmar agora" onPress={() => router.push('/verificar-email')} />
          </View>
        </Card>
      ) : null}

      <Card>
        <SectionHeader title="Conta Riot" subtitle={primary ? 'Usada pela Academy, pelo diagnóstico e pela previsão de elo' : undefined} />
        {primary ? (
          <>
            <View style={styles.riot}>
              {showingPrimary && data?.player.rank ? <RankEmblem rank={data.player.rank} size={44} /> : <Ionicons name="game-controller-outline" size={28} color={colors.accentSoft} />}
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={type.h2}>
                  {primary.gameName}
                  <Text style={{ color: colors.textMuted }}> #{primary.tagLine}</Text>
                </Text>
                <Text style={type.bodySm}>
                  {primary.region}
                  {showingPrimary && data?.player.rank ? (
                    <Text style={{ color: TIER_COLOR[data.player.rank.tier] }}>
                      {' · '}
                      {rankLabel(data.player.rank)} {data.player.rank.lp} LP
                    </Text>
                  ) : null}
                </Text>
                <StatusBadge label={primary.verificationStatus === 'rso_verified' ? 'VERIFICADA (RSO)' : 'NÃO VERIFICADA'} tone={primary.verificationStatus === 'rso_verified' ? 'success' : 'neutral'} />
              </View>
            </View>
            {primary.verificationStatus === 'unverified' ? (
              <Text style={[type.bodySm, { marginTop: space.md }]}>
                Perfil não verificado: o Riot ID existe, mas a posse da conta não foi comprovada. A comprovação oficial depende do Riot Sign On.
              </Text>
            ) : null}
            <View style={{ marginTop: space.md, gap: space.sm }}>
              <Button label="Ver minhas estatísticas" icon="stats-chart-outline" onPress={() => router.navigate('/')} />
            </View>
          </>
        ) : (
          <Text style={type.bodySm}>Nenhuma conta vinculada. Vincule sua conta Riot para que suas estatísticas, aulas e previsões fiquem associadas ao seu perfil.</Text>
        )}
        <View style={{ marginTop: space.sm }}>
          <Button label={primary ? 'Gerenciar contas Riot' : 'Vincular conta Riot'} variant={primary ? 'secondary' : 'primary'} icon="link-outline" onPress={() => router.push('/conta/riot')} />
        </View>
      </Card>

      <Card padded={false}>
        <Row icon="school-outline" title="Academy e previsão" detail="Progresso, plano semanal e metas" onPress={() => router.push('/academy')} />
        <Row icon="settings-outline" title="Configurações da conta" detail="Preferências, senha e exclusão da conta" onPress={() => router.push('/conta/configuracoes')} />
        <Row icon="phone-portrait-outline" title="Sessões e dispositivos" detail="Veja onde sua conta está conectada" onPress={() => router.push('/conta/sessoes')} last />
      </Card>

      <FormNotice icon="flask-outline">Os dados demonstrativos continuam disponíveis em Perfil → Fonte de dados e nunca são associados à sua conta.</FormNotice>
      <Button label="Sair da conta" variant="secondary" icon="log-out-outline" onPress={logout} loading={leaving} />
    </Screen>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={type.label}>{label}</Text>
      <Text style={[type.h3, { marginTop: 3 }]}>{value}</Text>
    </View>
  );
}

function Row({ icon, title, detail, onPress, last }: { icon: IconName; title: string; detail: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { backgroundColor: colors.surfaceHigh }]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={colors.accentSoft} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={type.h3}>{title}</Text>
        <Text style={type.bodySm}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentDim, borderWidth: 1.5, borderColor: colors.gold },
  avatarText: { fontFamily: fonts.displayBold, fontSize: 26, color: colors.accentSoft },
  meta: { flexDirection: 'row', gap: space.md, marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  riot: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  rowIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentDim },
});
