import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { LineChart } from '@/components/charts';
import { LatestReportCard } from '@/components/report/LatestReportCard';
import { InsightCard } from '@/components/ui';
import { champion, POSITION_LABEL } from '@/data/champions';
import type { Derived } from '@/state/PlayerContext';
import { byChampion, matchKda } from '@/stats/aggregate';
import { dateShort, dec, duration, int, relativeDay } from '@/stats/format';
import { absoluteToRank, rankShort } from '@/stats/rank';
import { lpSeries, rollingWinRate, snapshotSeries } from '@/stats/timeseries';
import { colors, type } from '@/theme';
import type { Match } from '@/types';

import { ChampCell, DataTable, MIN_TABLE, Panel, ResultPill, T, Tabs, WinRate, type Column } from './kit';

/** Evolução de LP (ou taxa de vitória móvel) com o mesmo cálculo do aplicativo. */
export function EvolutionPanel({ data, days }: { data: Derived; days: number }) {
  const [mode, setMode] = useState<'lp' | 'wr'>('lp');
  const real = data.source === 'riot';
  const points = useMemo(() => {
    const from = days ? data.asOf - days * 86_400_000 : 0;
    const all = mode === 'lp' ? (real ? snapshotSeries(data.rankHistory) : lpSeries(data.matches)) : rollingWinRate(data.matches, 10);
    return all.filter((p) => (p.t ?? 0) > from);
  }, [data, mode, days, real]);
  const lpFormat = (v: number) => {
    const r = absoluteToRank(v);
    return `${rankShort(r)} ${r.lp}`;
  };
  const change = points.length > 1 ? points[points.length - 1].y - points[0].y : 0;
  const first = data.rankHistory.find((x) => x.queue === 'SOLO');
  return (
    <Panel
      title="Evolução recente"
      subtitle={mode === 'lp' ? (real ? 'Elo registrado pelo LOL Insight a cada atualização da conta' : 'Elo e LP após cada partida Solo/Duo') : 'Taxa de vitória nas 10 partidas anteriores a cada ponto'}
      right={<Tabs value={mode} onChange={setMode} options={[{ value: 'lp', label: 'LP' }, { value: 'wr', label: 'Vitórias %' }]} />}>
      <LineChart
        points={points}
        height={260}
        yFormat={mode === 'lp' ? lpFormat : (v) => `${Math.round(v)}%`}
        label={mode === 'lp' ? 'LP' : 'taxa de vitória'}
        reference={mode === 'wr' ? { y: 50, label: '50%' } : undefined}
        resultDots={mode === 'lp'}
        emptyMessage={mode === 'lp' && real ? 'A Riot não fornece histórico de LP; os pontos aparecem conforme o elo é registrado.' : 'Sem partidas suficientes neste período.'}
      />
      {points.length > 1 ? (
        <Text style={[type.bodySm, { marginTop: 8 }]}>
          <Text style={{ color: change >= 0 ? colors.good : colors.loss }}>
            {change >= 0 ? '+' : '−'}
            {Math.abs(Math.round(change))}
            {mode === 'lp' ? ' LP' : ' p.p.'}
          </Text>{' '}
          no período · {points.length} pontos
        </Text>
      ) : null}
      {mode === 'lp' && real ? (
        <Text style={[type.bodySm, { marginTop: 6 }]}>
          A Riot não fornece o histórico de LP. {first ? `Acompanhamento desde ${dateShort(first.t)}.` : 'O acompanhamento começa na primeira consulta.'}
        </Text>
      ) : null}
    </Panel>
  );
}

/** Tabela de partidas (usada na Visão geral, no campeão e no histórico). */
export function MatchTable({ matches, asOf, pageSize = 10, minWidth = 720, compact }: { matches: Match[]; asOf: number; pageSize?: number; minWidth?: number; compact?: boolean }) {
  const router = useRouter();
  const cols: Column<Match>[] = [
    { key: 'champ', label: 'Campeão', flex: 2, render: (m) => <ChampCell id={m.championId} sub={`${POSITION_LABEL[m.position]} · vs ${champion(m.opponentChampionId).name}`} />, sort: (m) => m.championId },
    { key: 'res', label: 'Resultado', width: 96, render: (m) => <ResultPill win={m.win} />, sort: (m) => (m.win ? 1 : 0) },
    { key: 'kda', label: 'K / D / A', width: 110, align: 'right', render: (m) => <T mono strong>{`${m.kills} / ${m.deaths} / ${m.assists}`}</T>, sort: (m) => matchKda(m) },
    { key: 'kdar', label: 'KDA', width: 64, align: 'right', render: (m) => <T>{dec(matchKda(m), 2)}</T>, sort: (m) => matchKda(m) },
    { key: 'cs', label: 'CS', width: 60, align: 'right', render: (m) => <T>{int(m.cs)}</T>, sort: (m) => m.cs },
    { key: 'dmg', label: 'Dano', width: 80, align: 'right', render: (m) => <T>{int(m.damageDealt)}</T>, sort: (m) => m.damageDealt },
    { key: 'dur', label: 'Duração', width: 76, align: 'right', render: (m) => <T muted>{duration(m.durationSec)}</T>, sort: (m) => m.durationSec },
    { key: 'when', label: 'Quando', width: 110, align: 'right', render: (m) => <T muted>{relativeDay(m.timestamp, asOf)}</T>, sort: (m) => m.timestamp },
  ];
  const shown = compact ? cols.filter((c) => c.key !== 'dmg' && c.key !== 'kdar') : cols;
  return (
    <DataTable
      columns={shown}
      rows={matches}
      rowKey={(m) => m.id}
      onRowPress={(m) => router.push({ pathname: '/partida/[id]', params: { id: m.id } })}
      rowLabel={(m) => `${m.win ? 'Vitória' : 'Derrota'} com ${m.championId}, ${m.kills}/${m.deaths}/${m.assists}`}
      pageSize={pageSize}
      minWidth={minWidth}
      empty="Nenhuma partida com estes filtros."
    />
  );
}

/** Principais campeões do período, ordenados por partidas. */
export function TopChampions({ matches, limit = 6 }: { matches: Match[]; limit?: number }) {
  const router = useRouter();
  const rows = useMemo(() => byChampion(matches).sort((a, b) => b.games - a.games).slice(0, limit), [matches, limit]);
  return (
    <DataTable
      columns={[
        { key: 'c', label: 'Campeão', flex: 2, render: (c) => <ChampCell id={c.championId} sub={`${c.games} partidas`} /> },
        { key: 'wr', label: 'Vitórias', width: 110, align: 'right', render: (c) => <WinRate value={c.winRate} games={c.games} min={MIN_TABLE} /> },
        { key: 'kda', label: 'KDA', width: 60, align: 'right', render: (c) => <T>{dec(c.kda, 2)}</T> },
      ]}
      rows={rows}
      rowKey={(c) => c.championId}
      onRowPress={(c) => router.push({ pathname: '/campeao/[id]', params: { id: c.championId } })}
      minWidth={300}
      empty="Sem partidas no período."
    />
  );
}

export function InsightsPanel({ data, limit = 4 }: { data: Derived; limit?: number }) {
  const router = useRouter();
  const list = data.insights.insights.slice(0, limit);
  return (
    <Panel title="Insights" subtitle="Observações com amostra suficiente" right={<Text style={[type.bodySm, { color: colors.accentSoft }]} onPress={() => router.push('/insights')}>Ver todos</Text>}>
      <View style={{ gap: 10 }}>
        {list.length ? list.map((i) => <InsightCard key={i.id} insight={i} compact />) : <Text style={type.bodySm}>Ainda não há partidas suficientes para observações confiáveis.</Text>}
      </View>
    </Panel>
  );
}

export function LatestReport({ data }: { data: Derived }) {
  if (!data.matches.length) return null;
  return <LatestReportCard match={data.matches[0]} asOf={data.asOf} source={data.source} playerId={data.player.id} tier={data.player.rank?.tier} />;
}
