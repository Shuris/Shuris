import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CountUp } from '@/components/ui';
import { colors, fonts, space } from '@/theme';

import { InfoTip } from './Tooltip';

export interface KpiDelta {
  text: string;
  /** true = melhorou, false = piorou, null = neutro. */
  good: boolean | null;
}

/** Indicador principal: rótulo, número grande e variação opcional em relação ao período anterior. */
export function Kpi({ label, value, hint, delta, info, accent }: { label: string; value: string; hint?: string; delta?: KpiDelta | null; info?: string; accent?: string }) {
  return (
    <View style={styles.kpi}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {info ? <InfoTip text={info} /> : null}
      </View>
      <CountUp text={value} style={[styles.value, accent ? { color: accent } : null]} numberOfLines={1} />
      {delta ? (
        <View style={styles.delta}>
          <Ionicons
            name={delta.good === null ? 'remove' : delta.good ? 'trending-up' : 'trending-down'}
            size={13}
            color={delta.good === null ? colors.textMuted : delta.good ? colors.good : colors.loss}
          />
          <Text style={[styles.hint, { color: delta.good === null ? colors.textMuted : delta.good ? colors.good : colors.loss }]}>{delta.text}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.hint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** Faixa de indicadores que se reorganiza em várias linhas conforme a largura. */
export function KpiStrip({ children, min = 124 }: { children: React.ReactNode; min?: number }) {
  return (
    <View style={styles.strip}>
      {React.Children.toArray(children).map((c, i) => (
        <View key={i} style={{ flexGrow: 1, flexBasis: min, minWidth: min }}>
          {c}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpi: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.hairline, paddingVertical: 14, paddingHorizontal: 16, gap: 4 },
  label: { fontFamily: fonts.bodySemi, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.textMuted, flexShrink: 1 },
  value: { fontFamily: fonts.displayBold, fontSize: 30, color: colors.text, lineHeight: 34 },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hint: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted },
});

export const kpiSpace = space.md;
