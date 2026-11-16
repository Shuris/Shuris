import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Insight } from '@/stats/insights';
import { colors, fonts, radius, space, type } from '@/theme';

import { CountUp } from './Motion';

const TONE = {
  positive: { color: colors.good, icon: 'arrow-up-circle' as const, label: 'Ponto forte' },
  negative: { color: colors.loss, icon: 'alert-circle' as const, label: 'Atenção' },
  neutral: { color: colors.gold, icon: 'bulb' as const, label: 'Padrão' },
};

export function InsightCard({ insight, compact }: { insight: Insight; compact?: boolean }) {
  const tone = TONE[insight.tone];
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name={tone.icon} size={15} color={tone.color} />
        <Text style={[type.label, { color: colors.textSecondary }]}>
          {insight.category} · {tone.label}
        </Text>
      </View>
      <View style={styles.metricRow}>
        <CountUp text={insight.metric} style={styles.metric} />
        <Text style={[type.bodySm, { flex: 1 }]} numberOfLines={2}>
          {insight.metricLabel}
        </Text>
      </View>
      <Text style={styles.text}>{insight.text}</Text>
      {!compact && insight.action ? (
        <View style={styles.action}>
          <Ionicons name="navigate-circle-outline" size={14} color={colors.accentSoft} />
          <Text style={styles.actionText}>{insight.action}</Text>
        </View>
      ) : null}
      {!compact ? (
        <Text style={styles.foot}>
          Amostra: {insight.sample} partidas · confiança {insight.confidence}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: space.lg,
    gap: space.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  metric: { fontFamily: fonts.displayBold, fontSize: 31.5, color: colors.text },
  text: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary },
  action: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: colors.accentDim,
    borderRadius: radius.sm,
    padding: 10,
  },
  actionText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 12.5, lineHeight: 18, color: colors.text },
  foot: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
});
