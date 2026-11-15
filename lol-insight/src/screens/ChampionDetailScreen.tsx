import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { BarChart, LineChart, type Bar } from '@/components/charts';
import { Card, ChampionAvatar, EmptyState, FadeIn, LinkButton, MatchRow, Meter, Screen, ScreenSkeleton, SectionHeader, Segmented, StatTile, TileGrid } from '@/components/ui';
import { champion, championSplashUrl, POSITION_LABEL } from '@/data/champions';
import { PERIOD_OPTIONS, type PeriodDays } from '@/hooks/usePeriod';
import { usePlayer } from '@/state/PlayerContext';
import { byPosition, matchups, streaks, summarize, withinDays } from '@/stats/aggregate';
import { compact, dec, int, pct } from '@/stats/format';
import { bucketize, cumulativeWinRate } from '@/stats/timeseries';
import { colors, space, type } from '@/theme';

const MATCHUP_MIN = 3;

export function ChampionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, data } = usePlayer();
  const router = useRouter();
  const [days, setDays] = useState<PeriodDays>(90);
  const [showAll, setShowAll] = useState(false);
  const [splashOk, setSplashOk] = useState(true);
  const c = champion(id);

  const list = useMemo(() => (data ? data.matches.filter((m) => m.championId === id) : []), [data, id]);
  const s = useMemo(() => summarize(list), [list]);
  const st = useMemo(() => streaks(list), [list]);
  const wr = useMemo(() => cumulativeWinRate(list), [list]);
  const mus = useMemo(() => matchups(list), [list]);
  const positions = useMemo(() => byPosition(list).filter((p) => p.games > 0), [list]);
  const kdaBars: Bar[] = useMemo(() => {
    if (!data) return [];
    return bucketize(withinDays(list, data.asOf, days), data.asOf, days).map((b) => ({
      label: b.label,
      value: b.summary.kda,
      valueLabel: dec(b.summary.kda, 1),
      title: b.title,
      detail: `KDA ${dec(b.summary.kda, 2)} · ${b.summary.games} ${b.summary.games === 1 ? 'partida' : 'partidas'} · ${b.summary.wins}V ${b.summary.losses}D`,
      color: colors.series1,
    }));
  }, [data, list, days]);

  if (status === 'loading' || !data) {
    return (
      <Screen title={c.name} back>
        <ScreenSkeleton cards={3} />
      </Screen>
    );
  }
  if (!list.length) {
    return (
      <Screen title={c.name} back>
        <Card>
          <EmptyState icon="shield-outline" title="Sem partidas com este campeão" message={`${data.player.gameName} ainda não jogou de ${c.name} no período analisado.`} actionLabel="Ver campeões" onAction={() => router.back()} />
        </Card>
      </Screen>
    );
  }

  const overall = data.summary;
  const visible = showAll ? list : list.slice(0, 5);

  return (
    <Screen title={c.name} subtitle={c.title} back>
      <Card padded={false}>
        <View style={[styles.splash, { backgroundColor: c.color }]}>
          {splashOk ? <Image source={{ uri: championSplashUrl(c.id) }} onError={() => setSplashOk(false)} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          <View style={styles.splashShade} />
          <View style={styles.splashContent}>
            <ChampionAvatar id={c.id} size={60} ring={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={type.h1}>{c.name}</Text>
              <Text style={[type.bodySm, { color: colors.textSecondary }]}>
                {s.games} partidas · {s.wins}V {s.losses}D
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[type.h1, { fontSize: 28 }]}>{pct(s.winRate)}</Text>
              <Text style={type.label}>vitórias</Text>
            </View>
          </View>
        </View>
        <View style={{ padding: space.lg }}>
          <TileGrid columns={3}>
            <StatTile label="KDA médio" value={dec(s.kda, 2)} hint={`${dec(s.avgKills)} / ${dec(s.avgDeaths)} / ${dec(s.avgAssists)}`} />
            <StatTile label="Farm médio" value={dec(s.csPerMin)} hint="CS/min" />
            <StatTile label="Dano médio" value={compact(s.avgDamage)} hint={`${int(s.damagePerMin)}/min`} />
            <StatTile label="Ouro/min" value={int(s.goldPerMin)} hint="economia" />
            <StatTile label="KP" value={pct(s.killParticipation)} hint="participação" />
            <StatTile label="Sequência" value={`${st.longestWin}V`} hint="melhor série" />
          </TileGrid>
          <Text style={[type.bodySm, { marginTop: space.md }]}>
            {Math.abs(s.winRate - overall.winRate) < 0.02
              ? `Taxa de vitória em linha com a sua média geral (${pct(overall.winRate)}).`
              : `${Math.abs(Math.round((s.winRate - overall.winRate) * 100))} pontos ${s.winRate > overall.winRate ? 'acima' : 'abaixo'} da sua média geral (${pct(overall.winRate)}).`}
            {s.games < 10 ? ' Amostra pequena: interprete com cautela.' : ''}
          </Text>
        </View>
      </Card>

      <Card>
        <SectionHeader title="Evolução da taxa de vitória" subtitle={`Percentual acumulado ao longo das ${s.games} partidas`} />
        <LineChart points={wr} yFormat={(v) => `${Math.round(v)}%`} yDomain={[0, 100]} label="Taxa de vitória acumulada" reference={{ y: 50, label: '50%' }} resultDots />
      </Card>

      <Card>
        <SectionHeader title="KDA por período" subtitle={`Agrupado por ${days <= 15 ? 'dia' : days <= 30 ? '3 dias' : 'semana'}`} />
        <Segmented style={{ marginBottom: space.md }} options={PERIOD_OPTIONS} value={days} onChange={setDays} />
        {kdaBars.length ? (
          <FadeIn trigger={days}>
            <BarChart bars={kdaBars.slice(-8)} height={120} trigger={days} />
          </FadeIn>
        ) : (
          <EmptyState icon="calendar-outline" title="Sem partidas no período" message={`Nenhuma partida com ${c.name} nos últimos ${days} dias.`} />
        )}
      </Card>

      <Card>
        <SectionHeader title="Desempenho por matchup" subtitle="Contra o oponente direto da mesma rota" />
        <View style={{ gap: space.md }}>
          {mus.map((m) => {
            const foe = champion(m.opponentId);
            const small = m.games < MATCHUP_MIN;
            return (
              <View key={m.opponentId} style={[styles.matchup, small && { opacity: 0.55 }]}>
                <ChampionAvatar id={foe.id} size={34} />
                <View style={{ flex: 1, gap: 5 }}>
                  <View style={styles.matchupHead}>
                    <Text style={type.h3}>vs {foe.name}</Text>
                    <Text style={type.bodySm}>
                      {small ? `${m.wins}V ${m.losses}D · amostra pequena` : `${pct(m.winRate)} · ${m.wins}V ${m.losses}D · KDA ${dec(m.kda, 1)}`}
                    </Text>
                  </View>
                  <Meter value={m.winRate} color={m.winRate >= 0.5 ? colors.win : colors.loss} height={5} />
                </View>
              </View>
            );
          })}
        </View>
        <Text style={[type.bodySm, { marginTop: space.md }]}>Matchups com menos de {MATCHUP_MIN} partidas aparecem esmaecidos e sem percentual.</Text>
      </Card>

      <Card>
        <SectionHeader title="Desempenho por posição" />
        <View style={{ gap: space.sm }}>
          {positions.map((p) => (
            <View key={p.position} style={styles.posRow}>
              <Text style={[type.h3, { width: 70 }]}>{POSITION_LABEL[p.position]}</Text>
              <Text style={[type.bodySm, { flex: 1 }]}>
                {p.games} partidas · {p.wins}V {p.losses}D
              </Text>
              <Text style={type.h3}>{pct(p.winRate)}</Text>
              <Text style={[type.bodySm, { width: 64, textAlign: 'right' }]}>KDA {dec(p.kda, 1)}</Text>
            </View>
          ))}
        </View>
      </Card>

      <View>
        <SectionHeader
          title={`Histórico com ${c.name}`}
          subtitle={`${list.length} partidas`}
          right={list.length > 5 ? <LinkButton label={showAll ? 'Mostrar menos' : 'Ver todas'} onPress={() => setShowAll((v) => !v)} /> : undefined}
        />
        <View style={{ gap: space.sm }}>
          {visible.map((m) => (
            <MatchRow key={m.id} match={m} asOf={data.asOf} detailed onPress={() => router.push({ pathname: '/partida/[id]', params: { id: m.id } })} />
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  splash: { height: 150, justifyContent: 'flex-end' },
  splashShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(7,9,13,0.62)' },
  splashContent: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  matchup: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  matchupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  posRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
});
