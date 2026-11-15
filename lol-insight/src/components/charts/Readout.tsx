import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

/**
 * Leitura do ponto selecionado. Fica acima do gráfico (em vez de flutuar sobre
 * ele) para nunca cobrir os dados nem sair da tela em aparelhos pequenos.
 */
export function Readout({ title, detail, hint, color }: { title: string; detail: string; hint?: string; color?: string }) {
  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      <View style={[styles.dot, { backgroundColor: color ?? colors.accent }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.detail} numberOfLines={2}>
          {detail}
        </Text>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Legend({ items }: { items: Array<{ label: string; color: string; dashed?: boolean }> }) {
  return (
    <View style={styles.legend}>
      {items.map((it) => (
        <View key={it.label} style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: it.color }, it.dashed && { width: 14, height: 2, borderRadius: 1 }]} />
          <Text style={styles.legendText}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    marginBottom: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textMuted },
  detail: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text, marginTop: 1 },
  hint: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 9, height: 9, borderRadius: 3 },
  legendText: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textSecondary },
});
