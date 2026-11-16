import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radius, space, type } from '@/theme';

interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  /** Variação em relação ao período de comparação (texto já formatado). */
  delta?: { text: string; good: boolean } | null;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function StatTile({ label, value, hint, delta, selected, onPress, style }: StatTileProps) {
  const body = (
    <>
      <Text style={type.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {delta ? (
        <View style={styles.delta}>
          <Ionicons name={delta.good ? 'trending-up' : 'trending-down'} size={12} color={delta.good ? colors.good : colors.loss} />
          <Text style={styles.hint}>{delta.text}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.hint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: !!selected }}
        style={({ pressed }) => [styles.tile, selected && styles.selected, pressed && { opacity: 0.75 }, style]}>
        {body}
      </Pressable>
    );
  }
  return <View style={[styles.tile, style]}>{body}</View>;
}

/** Grade responsiva: distribui os blocos em `columns` colunas. */
export function TileGrid({ children, columns = 3 }: { children: React.ReactNode; columns?: number }) {
  const items = React.Children.toArray(children);
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View style={{ gap: space.sm }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: space.sm }}>
          {row.map((child, j) => (
            <View key={j} style={{ flex: 1 }}>
              {child}
            </View>
          ))}
          {Array.from({ length: columns - row.length }, (_, k) => (
            <View key={`f${k}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Barra dividida de vitórias/derrotas. */
export function WinLossBar({ wins, losses, height = 6 }: { wins: number; losses: number; height?: number }) {
  const total = wins + losses;
  if (!total) return <View style={{ height, borderRadius: height / 2, backgroundColor: colors.surfaceHigh }} />;
  return (
    <View style={{ flexDirection: 'row', gap: 2, height }}>
      {wins > 0 ? <View style={{ flex: wins, backgroundColor: colors.win, borderRadius: height / 2 }} /> : null}
      {losses > 0 ? <View style={{ flex: losses, backgroundColor: colors.loss, borderRadius: height / 2 }} /> : null}
    </View>
  );
}

/** Barra horizontal de proporção (0–1). */
export function Meter({ value, color = colors.accent, height = 6 }: { value: number; color?: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: colors.surfaceHigh, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

export function ResultBadge({ win, small }: { win: boolean; small?: boolean }) {
  return (
    <View style={[styles.badge, { backgroundColor: win ? colors.winDim : colors.lossDim }, small && { height: 18, paddingHorizontal: 6 }]}>
      <Text style={[styles.badgeText, { color: win ? colors.accentSoft : colors.loss }, small && { fontSize: 9.5 }]}>
        {win ? 'VITÓRIA' : 'DERROTA'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: 11,
    paddingHorizontal: 12,
    minHeight: 74,
    gap: 3,
  },
  selected: { borderColor: 'rgba(92,155,255,0.6)', backgroundColor: colors.accentDim },
  value: { fontFamily: fonts.display, fontSize: 21.5, color: colors.text },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badge: { height: 22, paddingHorizontal: 8, borderRadius: 6, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 0.7 },
});
