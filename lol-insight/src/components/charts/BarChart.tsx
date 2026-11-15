import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

import { Readout } from './Readout';

export interface Bar {
  label: string;
  /** Valor total da barra (soma dos segmentos, quando houver). */
  value: number;
  /** Segmentos empilhados de baixo para cima. */
  segments?: Array<{ value: number; color: string }>;
  color?: string;
  title: string;
  detail: string;
  /** Texto curto exibido acima da barra. */
  valueLabel?: string;
  muted?: boolean;
}

interface BarChartProps {
  bars: Bar[];
  height?: number;
  /** Valor máximo do eixo (padrão: maior barra). */
  max?: number;
  /** Índice selecionado inicialmente. */
  initial?: number;
  trigger?: unknown;
}

/** Barras verticais com seleção por toque e crescimento animado. */
export function BarChart({ bars, height = 150, max, initial, trigger }: BarChartProps) {
  const [selected, setSelected] = useState<number | null>(initial ?? null);
  const grow = useRef(new Animated.Value(0)).current;
  const signature = bars.map((b) => b.value.toFixed(2)).join('|');
  useEffect(() => {
    grow.setValue(0);
    Animated.timing(grow, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [signature, trigger, grow]);
  useEffect(() => setSelected(initial ?? null), [trigger, initial]);

  const top = max ?? Math.max(...bars.map((b) => b.value), 1e-6);
  const best = bars.reduce((bi, b, i) => (b.value > bars[bi].value ? i : bi), 0);
  const active = bars[selected ?? best];

  return (
    <View>
      <Readout title={active.title} detail={active.detail} hint={selected === null ? 'Toque em uma barra' : undefined} color={active.color ?? active.segments?.[0]?.color} />
      <View style={[styles.plot, { height: height + 18 }]}>
        {bars.map((b, i) => {
          const h = Math.max(b.value > 0 ? 3 : 0, (b.value / top) * height);
          const isActive = (selected ?? best) === i;
          const dim = selected !== null && !isActive;
          return (
            <Pressable
              key={b.label}
              onPress={() => setSelected(i)}
              accessibilityRole="button"
              accessibilityLabel={`${b.title}: ${b.detail}`}
              style={styles.col}>
              <Text style={[styles.valueLabel, isActive && { color: colors.text }]} numberOfLines={1}>
                {b.valueLabel ?? ''}
              </Text>
              <Animated.View
                style={{
                  width: '100%',
                  maxWidth: 34,
                  height: grow.interpolate({ inputRange: [0, 1], outputRange: [0, h] }),
                  opacity: dim || b.muted ? 0.45 : 1,
                  gap: 2,
                  flexDirection: 'column-reverse',
                }}>
                {b.segments ? (
                  b.segments
                    .filter((s) => s.value > 0)
                    .map((s, j, arr) => (
                      <View
                        key={j}
                        style={{
                          flex: s.value,
                          backgroundColor: s.color,
                          borderTopLeftRadius: j === arr.length - 1 ? 4 : 0,
                          borderTopRightRadius: j === arr.length - 1 ? 4 : 0,
                        }}
                      />
                    ))
                ) : (
                  <View style={{ flex: 1, backgroundColor: b.color ?? colors.series1, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                )}
              </Animated.View>
            </Pressable>
          );
        })}
        <View style={styles.baseline} pointerEvents="none" />
      </View>
      <View style={styles.labels}>
        {bars.map((b, i) => (
          <Text key={b.label} style={[styles.label, (selected ?? best) === i && { color: colors.text }]} numberOfLines={1}>
            {b.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  valueLabel: { fontFamily: fonts.bodySemi, fontSize: 10.5, color: colors.textSecondary, marginBottom: 4 },
  baseline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: colors.border },
  labels: { flexDirection: 'row', gap: 6, marginTop: 6 },
  label: { flex: 1, textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 10.5, color: colors.textMuted },
});
