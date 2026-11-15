import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';
import type { Match } from '@/types';

/** Sequência de resultados (mais antigo → mais recente), com as sequências de 3+ destacadas. */
export function StreakStrip({ matches }: { matches: Match[] }) {
  // Agrupa em sequências consecutivas de mesmo resultado.
  const runs: Array<{ win: boolean; length: number }> = [];
  for (const m of matches) {
    const last = runs[runs.length - 1];
    if (last && last.win === m.win) last.length++;
    else runs.push({ win: m.win, length: 1 });
  }
  return (
    <View style={styles.wrap} accessibilityLabel="Sequência de resultados">
      {runs.map((run, i) => (
        <View key={i} style={[styles.run, run.length >= 3 && { backgroundColor: run.win ? colors.winDim : colors.lossDim, paddingHorizontal: 3 }]}>
          {Array.from({ length: run.length }, (_, j) => (
            <View key={j} style={[styles.dot, { backgroundColor: run.win ? colors.win : colors.loss }]} />
          ))}
          {run.length >= 3 ? <Text style={[styles.count, { color: run.win ? colors.accentSoft : colors.loss }]}>{run.length}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, rowGap: 6 },
  run: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 18, borderRadius: 6 },
  dot: { width: 8, height: 12, borderRadius: 3 },
  count: { fontFamily: fonts.bodyBold, fontSize: 10, marginLeft: 2, marginRight: 1 },
});
