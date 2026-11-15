import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radius, space } from '@/theme';

export interface Option<T extends string | number> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string | number> {
  options: ReadonlyArray<Option<T>>;
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

/** Controle segmentado com realce deslizante. */
export function Segmented<T extends string | number>({ options, value, onChange, style, compact }: SegmentedProps<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const anim = useRef(new Animated.Value(index)).current;
  const [width, setWidth] = React.useState(0);
  useEffect(() => {
    Animated.spring(anim, { toValue: index, useNativeDriver: true, speed: 22, bounciness: 4 }).start();
  }, [anim, index]);
  const itemW = width > 0 ? (width - 6) / options.length : 0;

  return (
    <View
      style={[styles.segmented, compact && { alignSelf: 'flex-start' }, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist">
      {itemW > 0 ? (
        <Animated.View
          style={[
            styles.thumb,
            { width: itemW, transform: [{ translateX: Animated.multiply(anim, itemW) }] },
          ]}
        />
      ) : null}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[styles.segment, compact && { flex: 0, minWidth: 46, paddingHorizontal: 12 }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
            hitSlop={4}>
            <Text style={[styles.segmentText, active && { color: colors.text }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Exibe seta de menu (o chip abre um seletor). */
  dropdown?: boolean;
}

export function Chip({ label, active, onPress, icon, dropdown }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.7 }]}>
      {icon ? <Ionicons name={icon} size={13} color={active ? colors.accentSoft : colors.textSecondary} /> : null}
      <Text style={[styles.chipText, active && { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
      {dropdown ? <Ionicons name="chevron-down" size={12} color={active ? colors.accentSoft : colors.textMuted} /> : null}
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingRight: space.lg }}>
      {children}
    </ScrollView>
  );
}

/** Botão de texto com seta, usado em "ver todos". */
export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}>
      <Text style={styles.linkText}>{label}</Text>
      <Ionicons name="chevron-forward" size={13} color={colors.accentSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  thumb: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: radius.md - 3,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: 'rgba(92,155,255,0.35)',
  },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, minHeight: 32 },
  segmentText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.textMuted },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accentDim, borderColor: 'rgba(92,155,255,0.5)' },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.textSecondary, maxWidth: 150 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 2 },
  linkText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.accentSoft },
});
