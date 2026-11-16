import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { LineChart } from '@/components/charts';
import { AuthPrompt } from '@/components/auth/AccountCard';
import { CoachEntry } from '@/components/coach/CoachEntry';
import { LatestReportCard } from '@/components/report/LatestReportCard';
import { DataStatusCard } from '@/components/DataStatusCard';
import { ErrorCard } from '@/components/ErrorCard';
import { SearchBar } from '@/components/SearchBar';
import { SourceBadge } from '@/components/SourceBadge';
import {
  Card,
  EmptyState,
  FadeIn,
  InsightCard,
  LinkButton,
  MatchRow,
  Meter,
  ProfileAvatar,
  AppMark,
  CountUp,
  RankEmblem,
  useProgress,
  Screen,
  ScreenSkeleton,
  SectionHeader,
  Segmented,
  StatTile,
  TileGrid,
} from '@/components/ui';
import { profileIconUrl } from '@/data/champions';
import { PERIOD_OPTIONS, type PeriodDays } from '@/hooks/usePeriod';
import { useAuth } from '@/state/AuthContext';
import { usePlayer, type Derived } from '@/state/PlayerContext';
import { compact, dateShort, dec, duration, int, pct } from '@/stats/format';
import { absoluteToRank, isApex, rankLabel, rankShort, TIER_COLOR } from '@/stats/rank';
import { lpSeries, rollingWinRate, snapshotSeries } from '@/stats/timeseries';
import { colors, fonts, space, type } from '@/theme';
import type { Region } from '@/types';

export function HomeScreen() {
  const { status, data, error, failedQuery, recent, suggestions, settings, search, setMode, dismissError } = usePlayer();
  const [region, setRegion] = useState<Region>('BR');
  const router = useRouter();
  const real = settings.mode === 'riot';
  const auth = useAuth();
  const needsLogin = real && auth.status === 'signedOut';

  // Ações oferecidas conforme o tipo de erro da busca.
  const errorActions = () => {
    if (!error) return [];
    const actions: Array<{ label: string; onPress: () => void; primary?: boolean }> = [];
    if (error.code === 'WRONG_REGION' && error.suggestedRegion && failedQuery) {
      const suggested = error.suggestedRegion;
      actions.push({ label: `Buscar em ${suggested}`, primary: true, onPress: () => (setRegion(suggested), void search({ ...failedQuery, region: suggested })) });
    }
    if (['RATE_LIMITED', 'RIOT_UNAVAILABLE', 'SERVER_UNREACHABLE', 'UNKNOWN'].includes(error.code) && failedQuery) {
      actions.push({ label: 'Tentar novamente', primary: true, onPress: () => void search(failedQuery) });
    }
    if (['SERVER_UNREACHABLE', 'MISSING_API_KEY', 'RIOT_AUTH'].includes(error.code)) {
      actions.push({ label: 'Configurar servidor', onPress: () => router.navigate('/perfil') });
      actions.push({ label: 'Usar demonstração', onPress: () => setMode('demo') });
    }
    if (data) actions.push({ label: `Voltar para ${data.player.gameName}`, onPress: dismissError });
    return actions;
  };

  return (
    <Screen>
      <View style={styles.brand}>
        <AppMark size={32} />
        <Text style={[styles.wordmark, { flex: 1 }]}>
          LOL <Text style={{ color: colors.gold }}>INSIGHT</Text>
        </Text>
        <SourceBadge />
      </View>

      <SearchBar
        region={region}
        onRegionChange={setRegion}
        onSearch={search}
        recent={recent}
        suggestions={suggestions}
        busy={status === 'loading'}
        placeholder={real ? 'Riot ID (Nome#TAG)' : 'Buscar invocador (Nome#TAG)'}
      />

      {status === 'loading' ? (
        <ScreenSkeleton cards={3} />
      ) : (
        <>
          {error ? <ErrorCard error={error} actions={errorActions()} /> : null}
          {needsLogin ? <AuthPrompt /> : null}
          {!data && !error && !needsLogin && real && auth.status === 'signedIn' && !auth.primary ? (
            <Card>
              <EmptyState
                icon="link-outline"
                title="Vincule sua conta Riot"
                message="Vincule seu Riot ID para que suas estatísticas, aulas e previsões fiquem no seu perfil. Você também pode pesquisar qualquer jogador acima."
                actionLabel="Vincular conta Riot"
                onAction={() => router.push('/conta/riot')}
              />
            </Card>
          ) : null}
          {!data && !error && !needsLogin && !(real && auth.status === 'signedIn' && !auth.primary) ? (
            <Card>
              <EmptyState
                icon="search-outline"
                title="Pesquise um jogador"
                message="Digite o Riot ID completo (Nome#TAG), escolha a região e toque na lupa para carregar o elo e as partidas reais da conta."
                actionLabel="Ver a demonstração"
                onAction={() => setMode('demo')}
              />
            </Card>
          ) : null}
          {data && !error ? (
            <FadeIn trigger={data.player.id} style={{ gap: space.lg }}>
              <PlayerHero data={data} />
              <DataStatusCard data={data} />
              {data.matches.length ? (
                <LatestReportCard match={data.matches[0]} asOf={data.asOf} source={data.source} playerId={data.player.id} tier={data.player.rank?.tier} />
              ) : null}
              <CoachEntry />
              {data.matches.length ? (
                <>
                  <Indicators data={data} />
                  <EvolutionCard data={data} />
                  <InsightsPreview data={data} onOpen={() => router.push('/insights')} />
                  <View>
                    <SectionHeader title="Últimas partidas" right={<LinkButton label="Ver histórico" onPress={() => router.navigate('/partidas')} />} />
                    <View style={{ gap: space.sm }}>
                      {data.matches.slice(0, 5).map((m) => (
                        <MatchRow key={m.id} match={m} asOf={data.asOf} onPress={() => router.push({ pathname: '/partida/[id]', params: { id: m.id } })} />
                      ))}
                    </View>
                  </View>
                </>
              ) : (
                <Card>
                  <EmptyState
                    icon="game-controller-outline"
                    title={data.sync?.state === 'syncing' || data.sync?.state === 'waiting_rate_limit' ? 'Carregando partidas…' : 'Sem partidas para analisar'}
                    message={
                      data.sync?.state === 'syncing' || data.sync?.state === 'waiting_rate_limit'
                        ? 'As partidas aparecem aqui conforme são baixadas da Riot.'
                        : "Não há partidas de Summoner's Rift entre as mais recentes desta conta. Aumente a quantidade de partidas analisadas."
                    }
                  />
                </Card>
              )}
            </FadeIn>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function PlayerHero({ data }: { data: Derived }) {
  const { player, peakRank } = data;
  const rank = player.rank;
  const tier = rank ? TIER_COLOR[rank.tier] : colors.textMuted;
  const season = player.ranked?.solo;
  const flex = player.ranked?.flex;
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
        <ProfileAvatar name={player.gameName} uri={profileIconUrl(player.profileIconId)} level={player.level} size={68} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.h1} numberOfLines={1}>
            {player.gameName}
            <Text style={[type.tag, { fontSize: 18 }]}> #{player.tagLine}</Text>
          </Text>
          <Text style={type.bodySm}>
            {player.region} · Nível {player.level}
          </Text>
        </View>
      </View>

      <View style={styles.rankRow}>
        {rank ? (
          <RankEmblem rank={rank} size={52} />
        ) : (
          <View style={styles.unranked}>
            <Ionicons name="shield-outline" size={24} color={colors.textMuted} />
          </View>
        )}
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text style={[type.h2, { color: tier }]}>{rank ? rankLabel(rank) : 'Sem elo'}</Text>
            {rank ? (
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <CountUp text={String(rank.lp)} style={type.number} />
                <Text style={styles.unit}> LP</Text>
              </View>
            ) : null}
          </View>
          {rank ? (
            // Mestre+ não tem teto de 100 LP: a barra só faz sentido nas ligas com divisões.
            isApex(rank) ? null : <Meter value={rank.lp / 100} color={tier} />
          ) : (
            <Text style={type.bodySm}>Conta sem classificação na fila Solo/Duo nesta temporada.</Text>
          )}
          {season ? (
            <Text style={type.bodySm}>
              Temporada Solo/Duo: <Text style={{ color: colors.text }}>{season.wins}V {season.losses}D</Text> · {pct(season.wins / Math.max(1, season.wins + season.losses))}
              {season.hotStreak ? ' · em sequência' : ''}
            </Text>
          ) : null}
          {flex ? (
            <Text style={type.bodySm}>
              Flex: <Text style={{ color: colors.text }}>{rankLabel(flex.rank)}</Text> · {flex.rank.lp} LP · {flex.wins}V {flex.losses}D
            </Text>
          ) : null}
          {peakRank ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="trophy-outline" size={12} color={colors.gold} />
              <Text style={type.bodySm}>
                {data.source === 'riot' ? 'Melhor elo registrado' : 'Melhor elo'}: <Text style={{ color: colors.text }}>{rankLabel(peakRank)}</Text> · {peakRank.lp} LP
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function WinRing({ value, size = 84 }: { value: number; size?: number }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress = useProgress(value);
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
          strokeDasharray={`${c * value * progress} ${c}`}
        />
      </Svg>
      <CountUp text={pct(value)} style={styles.ringValue} />
    </View>
  );
}

function Indicators({ data }: { data: Derived }) {
  const s = data.summary;
  return (
    <Card>
      <SectionHeader
        title="Indicadores"
        subtitle={data.source === 'riot' ? `Calculados sobre ${s.games} ${s.games === 1 ? 'partida real' : 'partidas reais'}` : 'Últimos 90 dias · todas as filas'}
      />
      <View style={styles.wrRow}>
        <WinRing value={s.winRate} />
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={type.label}>Taxa de vitória geral</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <CountUp text={String(s.games)} style={type.number} />
            <Text style={styles.unit}> partidas</Text>
          </View>
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
  const real = data.source === 'riot';

  const points = useMemo(() => {
    const from = data.asOf - days * 86_400_000;
    // Dados reais: a Riot não informa o LP por partida, então a série vem dos snapshots registrados pelo backend.
    const all = mode === 'lp' ? (real ? snapshotSeries(data.rankHistory) : lpSeries(data.matches)) : rollingWinRate(data.matches, 10);
    return all.filter((p) => (p.t ?? 0) > from);
  }, [data, mode, days, real]);

  const change = points.length > 1 ? points[points.length - 1].y - points[0].y : 0;
  const lpFormat = (v: number) => {
    const r = absoluteToRank(v);
    return `${rankShort(r)} ${r.lp}`;
  };
  const firstSnapshot = data.rankHistory.find((x) => x.queue === 'SOLO');
  const lpSubtitle = real ? 'Elo e LP registrados pelo LOL Insight a cada atualização da conta' : 'Elo e LP a cada partida ranqueada Solo/Duo';
  const lpEmpty = real
    ? !data.player.rank
      ? 'Conta sem elo Solo/Duo: não há LP para acompanhar.'
      : firstSnapshot
        ? 'Nenhum registro de elo neste período. Escolha um período maior.'
        : 'O histórico de LP ainda não está disponível.'
    : 'Nenhuma partida ranqueada neste período. Escolha um período maior.';

  return (
    <Card>
      <SectionHeader title="Evolução" subtitle={mode === 'lp' ? lpSubtitle : 'Taxa de vitória nas 10 partidas anteriores a cada ponto'} />
      <View style={{ gap: space.sm, marginBottom: space.md }}>
        <Segmented
          options={[
            { value: 'lp', label: 'LP' },
            { value: 'wr', label: 'Vitórias %' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <Segmented options={PERIOD_OPTIONS} value={days} onChange={setDays} />
      </View>
      <LineChart
        points={points}
        yFormat={mode === 'lp' ? lpFormat : (v) => `${Math.round(v)}%`}
        label={mode === 'lp' ? 'LP' : 'taxa de vitória'}
        reference={mode === 'wr' ? { y: 50, label: '50%' } : undefined}
        resultDots={mode === 'lp'}
        emptyMessage={mode === 'lp' ? lpEmpty : 'Partidas insuficientes neste período para calcular a taxa de vitória (mínimo de 5).'}
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
            {days === 365 ? 'no último ano' : `nos últimos ${days} dias`} · {points.length} {mode === 'lp' && real ? 'registros' : 'partidas'}
          </Text>
        </View>
      ) : null}
      {mode === 'lp' && real && data.player.rank ? (
        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} style={{ marginTop: 1 }} />
          <Text style={[type.bodySm, { flex: 1 }]}>
            A Riot não fornece o histórico de LP.{' '}
            {firstSnapshot
              ? `O acompanhamento desta conta começou em ${dateShort(firstSnapshot.t)}; cada atualização adiciona um ponto quando o elo muda.`
              : 'O acompanhamento começa na primeira consulta bem-sucedida.'}
            {points.length === 1 ? ' Com um único registro ainda não há linha de evolução.' : ''}
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
  wordmark: { fontFamily: fonts.title, fontSize: 16, color: colors.text, letterSpacing: 2 },
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
  ringValue: { fontFamily: fonts.displayBold, fontSize: 21.5, color: colors.text },
  change: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md },
  note: { flexDirection: 'row', gap: 8, marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  unranked: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
});
