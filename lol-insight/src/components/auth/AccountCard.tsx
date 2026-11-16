import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { useAuth } from '@/state/AuthContext';
import { colors, fonts, radius, space, type } from '@/theme';

import { Button, StatusBadge } from './Form';

/**
 * Cartão da conta do usuário, exibido no modo real. Sem login convida a entrar;
 * com login mostra o perfil e a conta Riot principal.
 */
export function AccountCard() {
  const auth = useAuth();
  const router = useRouter();

  if (auth.status === 'loading') return null;
  if (auth.status === 'unreachable') {
    return (
      <Card>
        <Text style={type.h3}>Servidor inacessível</Text>
        <Text style={[type.bodySm, { marginTop: 4 }]}>Sua sessão continua salva. Confira o endereço do servidor em Perfil → Fonte de dados e tente de novo.</Text>
        <View style={{ marginTop: space.md }}>
          <Button label="Tentar de novo" variant="secondary" onPress={() => void auth.reload()} />
        </View>
      </Card>
    );
  }
  if (auth.status !== 'signedIn' || !auth.user) return <AuthPrompt />;

  const p = auth.primary;
  return (
    <Pressable onPress={() => router.push('/conta')} accessibilityRole="button" accessibilityLabel="Abrir minha conta" style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfaceHigh }]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{auth.user.username[0].toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={type.label}>Minha conta</Text>
        <Text style={type.h3} numberOfLines={1}>
          {auth.user.username}
        </Text>
        <Text style={type.bodySm} numberOfLines={1}>
          {p ? `${p.gameName}#${p.tagLine} · ${p.region}` : 'Nenhuma conta Riot vinculada'}
        </Text>
        {!auth.user.emailVerified ? <StatusBadge label="E-MAIL NÃO CONFIRMADO" tone="warning" /> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

export function AuthPrompt({ compact }: { compact?: boolean }) {
  const router = useRouter();
  return (
    <Card style={{ borderColor: 'rgba(92,155,255,0.4)' }}>
      <View style={styles.promptHead}>
        <View style={styles.promptIcon}>
          <Ionicons name="person-circle-outline" size={22} color={colors.accentSoft} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.h3}>Entre para usar os dados reais</Text>
          <Text style={type.bodySm}>
            {compact ? 'Sua conta guarda a conta Riot vinculada e o progresso da Academy.' : 'Com uma conta você vincula sua conta Riot, e seu progresso na Academy, metas e previsões ficam salvos só para você.'}
          </Text>
        </View>
      </View>
      <View style={styles.promptActions}>
        <View style={{ flex: 1 }}>
          <Button label="Entrar" onPress={() => router.push('/entrar')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Criar conta" variant="secondary" onPress={() => router.push('/cadastro')} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(92,155,255,0.35)' },
  avatar: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentDim, borderWidth: 1, borderColor: 'rgba(92,155,255,0.45)' },
  avatarText: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.accentSoft },
  promptHead: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  promptIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentDim },
  promptActions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
});
