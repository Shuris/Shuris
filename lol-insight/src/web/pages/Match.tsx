import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MatchReportView } from '@/components/report/MatchReportView';
import { EmptyState } from '@/components/ui';
import { champion } from '@/data/champions';
import { MatchBuild, MatchHeader, MatchSummary, MatchTeams, MatchTimeline, useMatchDetails } from '@/screens/MatchDetailScreen';
import { markReportSeen } from '@/services/reportSeen';
import type { Derived } from '@/state/PlayerContext';
import { dateTime, QUEUE_LABEL } from '@/stats/format';
import { colors, fonts } from '@/theme';

import { Button, DataGate, Page, Panel, Split, useBreakpoint } from './kit';

/** Partida em uma única página: relatório e estatísticas lado a lado, equipes, build e eventos. */
export function WebMatch() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return (
    <Page eyebrow="Partida" title="Análise da partida" actions={<Button kind="ghost" icon="arrow-back" label="Histórico" onPress={() => router.navigate('/partidas')} />}>
      <DataGate>{(d) => <Body data={d} id={id} />}</DataGate>
    </Page>
  );
}

function Body({ data, id }: { data: Derived; id: string }) {
  const base = useMemo(() => data.matches.find((m) => m.id === id), [data, id]);
  const { match, details, completedItems } = useMatchDetails(base);
  const { wide } = useBreakpoint();
  useEffect(() => {
    if (base && data.matches[0]?.id === base.id) void markReportSeen(data.source, data.player.id, base.id);
  }, [data, base]);
  if (!match)
    return (
      <Panel>
        <EmptyState icon="alert-circle-outline" title="Partida não encontrada" message="Esta partida não pertence à conta carregada." />
      </Panel>
    );
  return (
    <>
      <Text style={styles.sub}>
        {match.win ? 'Vitória' : 'Derrota'} com {champion(match.championId).name} · {QUEUE_LABEL[match.queue]} · {dateTime(match.timestamp)}
      </Text>
      <MatchHeader match={match} source={data.source} />
      <Split ratio={wide ? 1.15 : 1}>
        <View style={{ gap: 20 }}>
          <MatchReportView match={match} tier={data.player.rank?.tier} />
        </View>
        <View style={{ gap: 20 }}>
          <MatchSummary match={match} />
        </View>
      </Split>
      <MatchTeams match={match} />
      <Split ratio={1}>
        <View style={{ gap: 20 }}>
          <MatchBuild match={match} details={details} completedItems={completedItems} />
        </View>
        <View style={{ gap: 20 }}>
          <MatchTimeline match={match} details={details} />
        </View>
      </Split>
      <Text style={styles.note}>Os dados vêm da Match-V5 da Riot (na demonstração, são fictícios). O LOL Insight não estima o que a Riot não informa.</Text>
    </>
  );
}

const styles = StyleSheet.create({
  sub: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textSecondary, marginTop: -8 },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
});
