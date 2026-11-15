import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Chip, ChipRow, EmptyState, FadeIn, InsightCard, Screen, ScreenSkeleton, SectionHeader } from '@/components/ui';
import { usePlayer } from '@/state/PlayerContext';
import type { InsightTone } from '@/stats/insights';
import { colors, space, type } from '@/theme';

type Filter = 'all' | InsightTone;
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'positive', label: 'Pontos fortes' },
  { value: 'negative', label: 'Atenção' },
  { value: 'neutral', label: 'Padrões' },
];

export function InsightsScreen() {
  const { status, data } = usePlayer();
  const [filter, setFilter] = useState<Filter>('all');
  const report = data?.insights;
  const list = useMemo(() => (report ? report.insights.filter((i) => filter === 'all' || i.tone === filter) : []), [report, filter]);

  return (
    <Screen title="Insights" subtitle={data ? `Calculados sobre ${data.summary.games} partidas de ${data.player.gameName}` : undefined} back>
      {status === 'loading' || !data || !report ? (
        <ScreenSkeleton hero={false} cards={3} />
      ) : (
        <>
          <ChipRow>
            {FILTERS.map((f) => {
              const n = f.value === 'all' ? report.insights.length : report.insights.filter((i) => i.tone === f.value).length;
              return <Chip key={f.value} label={`${f.label} · ${n}`} active={filter === f.value} onPress={() => setFilter(f.value)} />;
            })}
          </ChipRow>

          <FadeIn trigger={filter} style={{ gap: space.md }}>
            {list.length ? (
              list.map((i) => <InsightCard key={i.id} insight={i} />)
            ) : (
              <Card>
                <EmptyState icon="bulb-outline" title="Nada nesta categoria" message="Nenhuma observação desta categoria atingiu a amostra mínima e a relevância exigidas." actionLabel="Ver todos" onAction={() => setFilter('all')} />
              </Card>
            )}
          </FadeIn>

          {report.skipped.length ? (
            <Card>
              <SectionHeader title="Análises sem conclusão" subtitle="Não geramos afirmações quando a amostra é pequena ou o efeito é irrelevante" />
              <View style={{ gap: space.md }}>
                {report.skipped.map((s) => (
                  <View key={s.id} style={styles.skipped}>
                    <Ionicons name="remove-circle-outline" size={15} color={colors.textMuted} style={{ marginTop: 1 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={type.h3}>{s.label}</Text>
                      <Text style={type.bodySm}>{s.reason}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          <Text style={[type.bodySm, { textAlign: 'center' }]}>
            Cada insight informa o tamanho da amostra. Correlações não garantem causa: use como ponto de partida para revisar suas partidas.
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  skipped: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
});
