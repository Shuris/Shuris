import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { LineChart } from '@/components/charts';
import { SearchBar } from '@/components/SearchBar';
import {
  Card,
  EmptyState,
  FadeIn,
  InsightCard,
  LinkButton,
  MatchRow,
  Meter,
  ProfileAvatar,
  RankEmblem,
  Screen,
  ScreenSkeleton,
  SectionHeader,
  Segmented,
  StatTile,
  TileGrid,
} from '@/components/ui';
import { profileIconUrl } from '@/data/champions';
import { PERIOD_OPTIONS, type PeriodDays } from '@/hooks/usePeriod';
import { usePlayer, type Derived } from '@/state/PlayerContext';
import { compact, dec, duration, int, pct } from '@/stats/format';
import { absoluteToRank, rankLabel, rankShort, TIER_COLOR } from '@/stats/rank';
import { lpSeries, rollingWinRate } from '@/stats/timeseries';
import { colors, fonts, space, type } from '@/theme';
import type { Region } from '@/types';

export function HomeScreen() {
  const { status, data, notFound, error, recent, suggestions, search, dismissNotFound } = usePlayer();
  const [region, setRegion] = useState<Region>('BR');
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Ionicons name="analytics" size={16} color={colors.accentSoft} />
        </View>
        <Text style={styles.wordmark}>
          LOL <Text style={{ color: colors.gold }}>INSIGHT</Text>
        </Text>
      </View>

      <SearchBar region={region} onRegionChange={setRegion} onSearch={search} recent={recent} suggestions={suggestions} busy={status === 'loading'} />

      {status === 'loading' ? (
        <ScreenSkeleton cards={3} />
      ) : (
        <>
          {notFound ? (
            <Card>
              <EmptyState
                icon="person-remove-outline"
                title="Invocador não encontrado"
                message={`Não encontramos "${notFound.gameName}${notFound.tagLine ? `#${notFound.tagLine}` : ''}" na região ${notFound.region}. Confira o nome, a tag e a região, ou escolha uma das contas sugeridas acima.`}
                actionLabel={data ? `Voltar para ${data.player.gameName}` : undefined}
                onAction={dismissNotFound}
              />
            </Card>
          ) : null}
          {error ? (
            <Card>
              <EmptyState icon="cloud-offline-outline" title="Não foi possível carregar" message={error} />
            </Card>
          ) : null}
          {data && !notFound ? (
            <FadeIn trigger={data.player.id} style={{ gap: space.lg }}>
              <PlayerHero data={data} />
              <Indicators data={data} />
              <EvolutionCard data={data} />
              <InsightsPreview data={data} onOpen={() => router.push('/insights')} />
              <View>
                <SectionHeader
                  title="Últimas partidas"
                  right={<LinkButton label="Ver histórico" onPress={() => router.navigate('/partidas')} />}
                />
                <View style={{ gap: space.sm }}>
                  {data.matches.slice(0, 5).map((m) => (
                    <MatchRow key={m.id} match={m} asOf={data.asOf} onPress={() => router.push({ pathname: '/partida/[id]', params: { id: m.id } })} />
                  ))}
                </View>
              </View>
            </FadeIn>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function PlayerHero({ data }: { data: Derived }) {
  const { player, peakRank } = data;
  const tier = TIER_COLOR[player.rank.tier];
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
        <ProfileAvatar name={player.gameName} uri={profileIconUrl(player.profileIconId)} level={player.level} size={68} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.h1} numberOfLines={1}>
            {player.gameName}
            <Text style={{ color: colors.textMuted, fontSize: 16 }}> #{player.tagLine}</Text>
          </Text>
          <Text style={type.bodySm}>
            {player.region} · Nível {player.level}
          </Text>
        </View>
      </View>

      <View style={styles.rankRow}>
        <RankEmblem rank={player.rank} size={52} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text style={[type.h2, { color: tier }]}>{rankLabel(player.rank)}</Text>
            <Text style={type.number}>
              {player.rank.lp}
              <Text style={styles.unit}> LP</Text>
            </Text>
          </View>
          <Meter value={player.rank.lp / 100} color={tier} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="trophy-outline" size={12} color={colors.gold} />
            <Text style={type.bodySm}>
              Melhor elo: <Text style={{ color: colors.text }}>{rankLabel(peakRank)}</Text> · {peakRank.lp} LP
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

function WinRing({ value, size = 84 }: { value: number; size?: number }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.lossDim} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.win}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * value} ${c}`}
        />
      </Svg>
      <Text style={styles.ringValue}>{pct(value)}</Text>
    </View>
  );
}

function Indicators({ data }: { data: Derived }) {
  const s = data.summary;
  return (
    <Card>
      <SectionHeader title="Indicadores" subtitle={`Últimos 90 dias · todas as filas`} />
      <View style={styles.wrRow}>
        <WinRing value={s.winRate} />
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={type.label}>Taxa de vitória geral</Text>
          <Text style={type.number}>
            {s.games} <Text style={styles.unit}>partidas</Text>
          </Text>
          <View style={{ flexDirection: 'row', gap: 2, height: 6 }}>
            <View style={{ flex: s.wins, backgroundColor: colors.win, borderRadius: 3 }} />
            <View style={{ flex: s.losses, backgroundColor: colors.loss, borderRadius: 3 }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[type.bodySm, { color: colors.accentSoft }]}>{s.wins} vitórias</Text>
            <Text style={[type.bodySm, { color: colors.loss }]}>{s.losses} derrotas</Text>
          </View>
        </View>
      </View>
      <TileGrid columns={3}>
        <StatTile label="KDA médio" value={dec(s.kda, 2)} hint={`${dec(s.avgKills)} / ${dec(s.avgDeaths)} / ${dec(s.avgAssists)}`} />
        <StatTile label="CS/min" value={dec(s.csPerMin)} hint="farm" />
        <StatTile label="Ouro/min" value={int(s.goldPerMin)} hint="economia" />
        <StatTile label="Dano médio" value={compact(s.avgDamage)} hint="por partida" />
        <StatTile label="KP" value={pct(s.killParticipation)} hint="participação" />
        <StatTile label="Duração" value={duration(s.avgDurationSec)} hint="média" />
      </TileGrid>
    </Card>
  );
}

type EvolutionMode = 'lp' | 'wr';

function EvolutionCard({ data }: { data: Derived }) {
  const [mode, setMode] = useState<EvolutionMode>('lp');
  const [days, setDays] = useState<PeriodDays>(30);

  const points = useMemo(() => {
    const from = data.asOf - days * 86_400_000;
    const all = mode === 'lp' ? lpSeries(data.matches) : rollingWinRate(data.matches, 10);
    return all.filter((p) => (p.t ?? 0) > from);
  }, [data, mode, days]);

  const change = points.length > 1 ? points[points.length - 1].y - points[0].y : 0;
  const lpFormat = (v: number) => {
    const r = absoluteToRank(v);
    return `${rankShort(r)} ${r.lp}`;
  };

  return (
    <Card>
      <SectionHeader
        title="Evolução"
        subtitle={mode === 'lp' ? 'Elo e LP a cada partida ranqueada Solo/Duo' : 'Taxa de vitória nas 10 partidas anteriores a cada ponto'}
      />
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
        <Segmented
          style={{ flex: 1 }}
          options={[
            { value: 'lp', label: 'LP' },
            { value: 'wr', label: 'Vitórias %' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <Segmented style={{ flex: 1.3 }} options={PERIOD_OPTIONS} value={days} onChange={setDays} />
      </View>
      <LineChart
        points={points}
        yFormat={mode === 'lp' ? lpFormat : (v) => `${Math.round(v)}%`}
        label={mode === 'lp' ? 'LP' : 'taxa de vitória'}
        reference={mode === 'wr' ? { y: 50, label: '50%' } : undefined}
        resultDots={mode === 'lp'}
        emptyMessage="Nenhuma partida ranqueada neste período. Escolha um período maior."
      />
      {points.length > 1 ? (
        <View style={styles.change}>
          <Ionicons name={change >= 0 ? 'trending-up' : 'trending-down'} size={14} color={change >= 0 ? colors.good : colors.loss} />
          <Text style={type.bodySm}>
            <Text style={{ color: colors.text, fontFamily: fonts.bodyBold }}>
              {change >= 0 ? '+' : '−'}
              {Math.abs(Math.round(change))}
              {mode === 'lp' ? ' LP' : ' p.p.'}
            </Text>{' '}
            nos últimos {days} dias · {points.length} partidas
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

function InsightsPreview({ data, onOpen }: { data: Derived; onOpen: () => void }) {
  const list = data.insights.insights;
  return (
    <View>
      <SectionHeader
        title="Insights"
        subtitle="Observações calculadas sobre as suas partidas"
        right={list.length ? <LinkButton label={`Ver todos (${list.length})`} onPress={onOpen} /> : undefined}
      />
      {list.length ? (
        <View style={{ gap: space.sm }}>
          {list.slice(0, 2).map((i) => (
            <InsightCard key={i.id} insight={i} compact />
          ))}
        </View>
      ) : (
        <Card>
          <EmptyState icon="bulb-outline" title="Ainda sem insights" message="São necessárias mais partidas para gerar observações confiáveis." />
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentDim, borderWidth: 1, borderColor: 'rgba(92,155,255,0.35)' },
  wordmark: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.text, letterSpacing: 2.2 },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.lg,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  unit: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  wrRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginBottom: space.lg },
  ringValue: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.text, letterSpacing: -0.4 },
  change: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md },
});
