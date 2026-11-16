import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, ChampionAvatar, PressableScale, Skeleton } from '@/components/ui';
import { champion } from '@/data/champions';
import { useMatchAnalysis } from '@/hooks/useMatchAnalysis';
import { lastSeenReport, onReportSeen } from '@/services/reportSeen';
import { relativeDay } from '@/stats/format';
import { buildMatchReport } from '@/stats/matchReport';
import { colors, fonts, radius, space, type } from '@/theme';
import type { Match, Tier } from '@/types';

/** Cartão da Início com o relatório automático da partida mais recente. */
export function LatestReportCard({ match, asOf, source, playerId, tier }: { match: Match; asOf: number; source: string; playerId: string; tier?: Tier | null }) {
  const router = useRouter();
  const state = useMatchAnalysis(match);
  const report = useMemo(() => buildMatchReport(match, state.status === 'ready' ? state.analysis : null, tier), [match, state, tier]);
  const [seen, setSeen] = useState(true);

  useEffect(() => {
    const check = () => void lastSeenReport(source, playerId).then((id) => setSeen(id === match.id));
    check();
    return onReportSeen(check);
  }, [source, playerId, match.id]);

  const c = champion(match.championId);
  const top = report.points.slice(0, 2);
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/partida/[id]', params: { id: match.id } })}
      accessibilityRole="button"
      accessibilityLabel="Abrir relatório da última partida">
      <Card style={{ borderColor: 'rgba(201,164,92,0.3)' }}>
        <View style={styles.head}>
          <Ionicons name="sparkles" size={14} color={colors.gold} />
          <Text style={[type.label, { color: colors.gold, flex: 1 }]}>Relatório da última partida</Text>
          {!seen ? (
            <View style={styles.new}>
              <Text style={styles.newText}>NOVO</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.row}>
          <ChampionAvatar id={c.id} size={42} ring={match.win ? colors.win : colors.loss} />
          <View style={{ flex: 1 }}>
            <Text style={type.h3}>
              {match.win ? 'Vitória' : 'Derrota'} com {c.name}
            </Text>
            <Text style={type.bodySm}>
              {match.kills}/{match.deaths}/{match.assists} · {relativeDay(match.timestamp, asOf)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
        {state.status === 'loading' ? (
          <View style={{ gap: 8, marginTop: space.md }}>
            <Skeleton height={14} />
            <Skeleton height={14} width="75%" />
          </View>
        ) : (
          <View style={{ gap: 6, marginTop: space.md }}>
            {top.map((p) => (
              <View key={p.key} style={styles.point}>
                <Ionicons name={p.tone === 'good' ? 'checkmark-circle' : 'alert-circle'} size={15} color={p.tone === 'good' ? colors.good : colors.loss} />
                <Text style={[type.bodySm, { flex: 1, color: colors.textSecondary }]} numberOfLines={2}>
                  <Text style={{ fontFamily: fonts.bodyBold, color: colors.text }}>{p.title}.</Text> {p.detail}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  point: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  new: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 8, height: 18, justifyContent: 'center' },
  newText: { fontFamily: fonts.bodyBold, fontSize: 9.5, color: colors.bg, letterSpacing: 0.8 },
});
