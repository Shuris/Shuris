import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radius, space, type } from '@/theme';

import { Card } from './Card';

/** Bloco pulsante exibido enquanto os dados carregam. */
export function Skeleton({ width = '100%', height = 14, style }: { width?: DimensionValue; height?: number; style?: StyleProp<ViewStyle> }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[{ width, height, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh, opacity: pulse }, style]} />;
}

/** Esqueleto genérico de tela: cabeçalho + cartões. */
export function ScreenSkeleton({ cards = 3, hero = true }: { cards?: number; hero?: boolean }) {
  return (
    <View style={{ gap: space.lg }} accessibilityLabel="Carregando dados">
      {hero ? (
        <Card>
          <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            <Skeleton width={64} height={64} style={{ borderRadius: 20 }} />
            <View style={{ flex: 1, gap: 10 }}>
              <Skeleton width="60%" height={18} />
              <Skeleton width="40%" />
              <Skeleton width="80%" height={8} />
            </View>
          </View>
        </Card>
      ) : null}
      {Array.from({ length: cards }, (_, i) => (
        <Card key={i}>
          <Skeleton width="45%" height={16} />
          <Skeleton width="70%" style={{ marginTop: 10 }} />
          <Skeleton height={i === 0 ? 150 : 96} style={{ marginTop: 16, borderRadius: radius.md }} />
        </Card>
      ))}
    </View>
  );
}

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'search-outline', title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={22} color={colors.accentSoft} />
      </View>
      <Text style={[type.h3, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.bodySm, { textAlign: 'center', maxWidth: 280 }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.7 }]}>
          <Text style={styles.emptyBtnText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Anima a entrada do conteúdo. Mudando `trigger` (ex.: ao aplicar um filtro)
 * a animação se repete, dando retorno visual de que os dados foram atualizados.
 */
export function FadeIn({ children, trigger, delay = 0, style }: { children: React.ReactNode; trigger?: unknown; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 320, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, trigger, delay]);
  return (
    <Animated.View
      style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.lg },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentDim,
    marginBottom: space.xs,
  },
  emptyBtn: {
    marginTop: space.sm,
    paddingHorizontal: 18,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  emptyBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#fff' },
});
