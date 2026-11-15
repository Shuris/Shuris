import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { usePlayer } from '@/state/PlayerContext';
import { colors, fonts } from '@/theme';

/**
 * Selo sempre visível indicando a origem dos dados na tela: demonstração
 * (fictícios) ou Riot API (reais). Tocar leva às configurações da fonte de dados.
 */
export function SourceBadge() {
  const { settings, data } = usePlayer();
  const router = useRouter();
  const source = data?.source ?? settings.mode;
  const real = source === 'riot';
  return (
    <Pressable
      onPress={() => router.navigate('/perfil')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={real ? 'Dados reais da Riot. Toque para alterar a fonte de dados' : 'Modo demonstração, dados fictícios. Toque para alterar a fonte de dados'}
      style={({ pressed }) => [styles.badge, real ? styles.real : styles.demo, pressed && { opacity: 0.7 }]}>
      <Ionicons name={real ? 'radio' : 'flask'} size={11} color={real ? colors.good : colors.gold} />
      <Text style={[styles.text, { color: real ? colors.good : colors.gold }]}>{real ? 'DADOS REAIS' : 'DEMO'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 24, paddingHorizontal: 9, borderRadius: 12, borderWidth: 1 },
  demo: { backgroundColor: colors.goldDim, borderColor: 'rgba(201,164,92,0.45)' },
  real: { backgroundColor: 'rgba(47,179,128,0.12)', borderColor: 'rgba(47,179,128,0.45)' },
  text: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.8 },
});
