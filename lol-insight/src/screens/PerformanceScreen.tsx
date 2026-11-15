import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BarChart, Heatmap, Legend, LineChart, type Bar } from '@/components/charts';
import { StreakStrip } from '@/components/StreakStrip';
import { Card, EmptyState, FadeIn, Screen, ScreenSkeleton, SectionHeader, Segmented, StatTile, TileGrid } from '@/components/ui';
import { POSITION_LABEL } from '@/data/champions';
import { PERIOD_OPTIONS, type PeriodDays } from '@/hooks/usePeriod';
import { usePlayer, type Derived } from '@/state/PlayerContext';
import { byPosition, chronological, streaks, summarize, withinDays, type Summary } from '@/stats/aggregate';
import { axisCompact, compact, dec, pct } from '@/stats/format';
import { bucketize, comparePeriods, consistency, csSeries, heatmap, kdaSeries, rollingWinRate, type SeriesPoint } from '@/stats/timeseries';
import { colors, space, type } from '@/theme';
import type { Match } from '@/types';

export function PerformanceScreen() {
  const { status, data } = usePlayer();
  const [days, setDays] = useState<PeriodDays>(30);

  return (
    <Screen
      title="Desempenho"
      subtitle={data ? `${data.player.gameName}#${data.player.tagLine} · análise avançada` : 'Análise avançada'}
      sticky={<Segmented style={{ flex: 1 }} options={PERIOD_OPTIONS} value={days} onChange={setDays} />}>
      {status === 'loading' || !data ? <ScreenSkeleton hero={false} cards={4} /> : <Content data={data} days={days} />}
    </Screen>
  );
}

function Content({ data, days }: { data: Derived; days: PeriodDays }) {
  const period = useMemo(() => withinDays(data.matches, data.asOf, days), [data, days]);

  if (!period.length) {
    return (
      <Card>
        <EmptyState icon="calendar-outline" title="Sem partidas no período" message={`Nenhuma partida nos últimos ${days} dias. Selecione um período maior.`} />
      </Card>
    );
  }

  return (
    <FadeIn trigger={days} style={{ gap: space.lg }}>
      <Text style={type.bodySm}>
        {period.length} partidas nos últimos {days} dias. O período acima se aplica a todos os gráficos.
      </Text>
      <KdaCard data={data} days={days} period={period} />
      <WinRateCard data={data} days={days} period={period} />
      <PositionCard period={period} days={days} />
      <HeatmapCard period={period} />
      <FarmCard period={period} />
      <CombatCard data={data} days={days} />
      <ConsistencyCard period={period} />
    </FadeIn>
  );
}

interface CardProps {
  data: Derived;
  days: PeriodDays;
  period: Match[];
}

function KdaCard({ data, days, period }: CardProps) {
  const points = useMemo(() => kdaSeries(data.matches, data.asOf, days), [data, days]);
  const s = useMemo(() => summarize(period), [period]);
  return (
    <Card>
      <SectionHeader eyebrow="Gráfico 1" title="Evolução do KDA" subtitle={`KDA médio por ${days <= 15 ? 'dia' : days <= 30 ? 'intervalo de 3 dias' : 'semana'}`} />
      <LineChart points={points} yFormat={(v) => dec(v, 1)} label="KDA" reference={{ y: s.kda, label: `Média do período (${dec(s.kda, 2)})` }} />
    </Card>
  );
}

function WinRateCard({ data, days, period }: CardProps) {
  const points = useMemo(() => {
    const from = data.asOf - days * 86_400_000;
    return rollingWinRate(data.matches, 10).filter((p) => (p.t ?? 0) > from);
  }, [data, days]);
  const cmp = useMemo(() => comparePeriods(data.matches, data.asOf, days), [data, days]);
  const diff = (cmp.current.winRate - cmp.previous.winRate) * 100;
  return (
    <Card>
      <SectionHeader eyebrow="Gráfico 2" title="Taxa de vitória" subtitle="Percentual de vitórias nas 10 partidas anteriores a cada ponto" />
      <LineChart points={points} yFormat={(v) => `${Math.round(v)}%`} label="Taxa de vitória (10 partidas)" reference={{ y: 50, label: '50%' }} yDomain={[20, 80]} />
      <View style={styles.compare}>
        <StatTile style={{ flex: 1 }} label={`Últimos ${days} dias`} value={pct(cmp.current.winRate)} hint={`${cmp.current.wins}V ${cmp.current.losses}D`} />
        {cmp.comparable ? (
          <StatTile
            style={{ flex: 1 }}
            label={`${days} dias anteriores`}
            value={pct(cmp.previous.winRate)}
            delta={{ text: `${diff >= 0 ? '+' : '−'}${Math.abs(Math.round(diff))} p.p. agora`, good: diff >= 0 }}
          />
        ) : (
          <StatTile style={{ flex: 1 }} label={`${days} dias anteriores`} value="—" hint="sem dados para comparar" />
        )}
      </View>
      {period.length < 10 ? <Text style={[type.bodySm, { marginTop: space.sm }]}>Poucas partidas no período: a curva considera partidas anteriores para completar a janela.</Text> : null}
    </Card>
  );
}

type PositionMetric = 'games' | 'winRate' | 'kda';

function PositionCard({ period, days }: { period: Match[]; days: PeriodDays }) {
  const [metric, setMetric] = useState<PositionMetric>('games');
  const stats = useMemo(() => byPosition(period), [period]);
  const bars: Bar[] = stats.map((p) => {
    const detail = p.games
      ? `${p.games} partidas · ${p.wins}V ${p.losses}D · ${pct(p.winRate)} · KDA ${dec(p.kda, 2)}`
      : 'Nenhuma partida nesta posição';
    const base = { label: POSITION_LABEL[p.position], title: POSITION_LABEL[p.position], detail, muted: p.games > 0 && p.games < 5 && metric !== 'games' };
    if (metric === 'games')
      return { ...base, value: p.games, valueLabel: p.games ? String(p.games) : '', segments: [{ value: p.wins, color: colors.win }, { value: p.losses, color: colors.loss }] };
    if (metric === 'winRate') return { ...base, value: p.winRate * 100, valueLabel: p.games ? pct(p.winRate) : '', color: colors.series1 };
    return { ...base, value: p.kda, valueLabel: p.games ? dec(p.kda, 1) : '', color: colors.series1 };
  });
  return (
    <Card>
      <SectionHeader eyebrow="Gráfico 3" title="Desempenho por posição" subtitle="Partidas, vitórias, derrotas e KDA em cada rota" />
      <Segmented
        style={{ marginBottom: space.md }}
        options={[
          { value: 'games', label: 'Partidas' },
          { value: 'winRate', label: 'Vitórias %' },
          { value: 'kda', label: 'KDA' },
        ]}
        value={metric}
        onChange={setMetric}
      />
      <BarChart bars={bars} max={metric === 'winRate' ? 100 : undefined} trigger={`${metric}-${days}`} />
      {metric === 'games' ? (
        <Legend items={[{ label: 'Vitórias', color: colors.win }, { label: 'Derrotas', color: colors.loss }]} />
      ) : (
        <Text style={[type.bodySm, { marginTop: space.sm }]}>Barras esmaecidas indicam posições com menos de 5 partidas.</Text>
      )}
    </Card>
  );
}

function HeatmapCard({ period }: { period: Match[] }) {
  const cells = useMemo(() => heatmap(period), [period]);
  return (
    <Card>
      <SectionHeader eyebrow="Gráfico 4" title="Horários de desempenho" subtitle="Taxa de vitória (%) por dia da semana e faixa de 3 horas" />
      <Heatmap cells={cells} />
    </Card>
  );
}

function FarmCard({ period }: { period: Match[] }) {
  const { points, moving, average } = useMemo(() => csSeries(period), [period]);
  const half = Math.floor(points.length / 2);
  const avg = (list: SeriesPoint[]) => (list.length ? list.reduce((s, p) => s + p.y, 0) / list.length : 0);
  const older = avg(points.slice(0, half));
  const newer = avg(points.slice(half));
  const diff = older > 0 ? newer / older - 1 : 0;
  return (
    <Card>
      <SectionHeader eyebrow="Gráfico 5" title="Evolução de farm" subtitle="CS/min por partida (suporte não entra no cálculo)" />
      <LineChart
        points={points}
        yFormat={(v) => dec(v, 1)}
        area={false}
        resultDots
        label="CS/min por partida"
        overlay={{ values: moving, label: 'Média móvel (5 partidas)' }}
        reference={{ y: average, label: `Média geral (${dec(average, 1)})` }}
        emptyMessage="Nenhuma partida fora do suporte neste período."
      />
      {points.length >= 6 ? (
        <View style={styles.compare}>
          <StatTile style={{ flex: 1 }} label="Partidas anteriores" value={dec(older, 1)} hint={`${half} primeiras do período`} />
          <StatTile
            style={{ flex: 1 }}
            label="Partidas recentes"
            value={dec(newer, 1)}
            delta={{ text: `${diff >= 0 ? '+' : '−'}${Math.abs(Math.round(diff * 100))}% vs anteriores`, good: diff >= 0 }}
          />
        </View>
      ) : null}
    </Card>
  );
}

type CombatKey = 'damage' | 'taken' | 'kp' | 'deaths' | 'vision';

const COMBAT: Array<{ key: CombatKey; label: string; get: (s: Summary) => number; fmt: (v: number) => string; axis?: (v: number) => string; higherIsBetter: boolean; unit: string }> = [
  { key: 'damage', label: 'Dano causado', get: (s) => s.avgDamage, fmt: compact, axis: axisCompact, higherIsBetter: true, unit: 'por partida' },
  { key: 'taken', label: 'Dano recebido', get: (s) => s.avgDamageTaken, fmt: compact, axis: axisCompact, higherIsBetter: false, unit: 'por partida' },
  { key: 'kp', label: 'Part. em abates', get: (s) => s.killParticipation * 100, fmt: (v) => `${Math.round(v)}%`, higherIsBetter: true, unit: 'da equipe' },
  { key: 'deaths', label: 'Mortes', get: (s) => s.avgDeaths, fmt: (v) => dec(v, 1), higherIsBetter: false, unit: 'por partida' },
  { key: 'vision', label: 'Visão/min', get: (s) => s.visionPerMin, fmt: (v) => dec(v, 2), higherIsBetter: true, unit: 'placar de visão' },
];

function CombatCard({ data, days }: { data: Derived; days: PeriodDays }) {
  const [key, setKey] = useState<CombatKey>('damage');
  const cmp = useMemo(() => comparePeriods(data.matches, data.asOf, days), [data, days]);
  const buckets = useMemo(() => bucketize(withinDays(data.matches, data.asOf, days), data.asOf, days), [data, days]);
  const metric = COMBAT.find((m) => m.key === key)!;
  const points: SeriesPoint[] = buckets.map((b) => ({
    y: metric.get(b.summary),
    xLabel: b.label,
    title: b.title,
    detail: `${metric.label}: ${metric.fmt(metric.get(b.summary))} · ${b.summary.games} ${b.summary.games === 1 ? 'partida' : 'partidas'}`,
  }));
  return (
    <Card>
      <SectionHeader eyebrow="Gráfico 6" title="Indicadores de combate" subtitle="Toque em um indicador para ver sua evolução" />
      <TileGrid columns={2}>
        {COMBAT.map((m) => {
          const cur = m.get(cmp.current);
          const prev = m.get(cmp.previous);
          const change = prev > 0 ? cur / prev - 1 : 0;
          return (
            <StatTile
              key={m.key}
              label={m.label}
              value={m.fmt(cur)}
              selected={m.key === key}
              onPress={() => setKey(m.key)}
              hint={m.unit}
              delta={
                cmp.comparable && Math.abs(change) >= 0.01
                  ? { text: `${change >= 0 ? '+' : '−'}${Math.abs(Math.round(change * 100))}% vs período anterior`, good: change >= 0 === m.higherIsBetter }
                  : null
              }
            />
          );
        })}
      </TileGrid>
      <View style={{ marginTop: space.lg }}>
        <LineChart points={points} yFormat={metric.axis ?? metric.fmt} label={metric.label} height={160} />
      </View>
    </Card>
  );
}

function ConsistencyCard({ period }: { period: Match[] }) {
  const ordered = useMemo(() => chronological(period), [period]);
  const report = useMemo(() => consistency(period), [period]);
  const st = useMemo(() => streaks(period), [period]);
  const total = ordered.length;
  const bars: Bar[] = report.histogram.map((b) => ({
    label: b.label,
    value: b.count,
    valueLabel: b.count ? String(b.count) : '',
    title: `KDA entre ${b.label.replace('–', ' e ')}`,
    detail: `${b.count} ${b.count === 1 ? 'partida' : 'partidas'} · ${pct(total ? b.count / total : 0)} do período`,
    color: colors.series1,
  }));
  const kdaPoints: SeriesPoint[] = ordered.slice(-40).map((m, i, arr) => {
    const kda = report.kdas[report.kdas.length - arr.length + i];
    return { y: Math.min(kda, 12), xLabel: `#${total - arr.length + i + 1}`, title: `Partida ${total - arr.length + i + 1} de ${total}`, detail: `KDA ${dec(kda, 1)} · ${m.kills}/${m.deaths}/${m.assists} · ${m.win ? 'vitória' : 'derrota'}`, win: m.win };
  });
  const verdict = report.score >= 65 ? 'Desempenho regular entre partidas' : report.score >= 45 ? 'Oscilação moderada entre partidas' : 'Desempenho bastante irregular';

  return (
    <Card>
      <SectionHeader eyebrow="Gráfico 7" title="Consistência" subtitle={verdict} />
      <TileGrid columns={3}>
        <StatTile label="Índice" value={`${report.score}`} hint="de 0 a 100" />
        <StatTile label="Mediana" value={dec(report.median, 1)} hint={`KDA · média ${dec(report.mean, 1)}`} />
        <StatTile label="Desvio" value={`±${dec(report.stdDev, 1)}`} hint="desvio-padrão" />
      </TileGrid>

      <Text style={[type.h3, styles.sub]}>Variação entre partidas</Text>
      <LineChart points={kdaPoints} yFormat={(v) => dec(v, 0)} area={false} resultDots label="KDA por partida" reference={{ y: report.median, label: `Mediana (${dec(report.median, 1)})` }} yDomain={[0, 8]} height={150} />

      <Text style={[type.h3, styles.sub]}>Sequências de resultados</Text>
      <StreakStrip matches={ordered.slice(-60)} />
      <View style={[styles.compare, { marginTop: space.md }]}>
        <StatTile style={{ flex: 1 }} label="Melhor série" value={`${st.longestWin}`} hint="vitórias" />
        <StatTile style={{ flex: 1 }} label="Pior série" value={`${st.longestLoss}`} hint="derrotas" />
        <StatTile style={{ flex: 1 }} label="Atual" value={`${Math.abs(st.current)}`} hint={st.current >= 0 ? 'vitórias' : 'derrotas'} />
      </View>

      <Text style={[type.h3, styles.sub]}>Distribuição de KDA</Text>
      <BarChart bars={bars} height={110} trigger={total} />
    </Card>
  );
}

const styles = StyleSheet.create({
  compare: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  sub: { marginTop: space.xl, marginBottom: space.md },
});
