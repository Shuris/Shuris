import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Heatmap } from '@/components/charts';
import { ProfileAvatar, RankEmblem } from '@/components/ui';
import { profileIconUrl } from '@/data/champions';
import type { Derived } from '@/state/PlayerContext';
import { byPosition, summarize } from '@/stats/aggregate';
import { compact, dec, int, pct, signed } from '@/stats/format';
import { rankLabel, TIER_COLOR } from '@/stats/rank';
import { consistency, heatmap } from '@/stats/timeseries';
import { colors, fonts } from '@/theme';

import { Button, Cols, DataGate, DataTable, delta, inPeriod, Kpi, KpiStrip, metric, MIN, Page, Panel, PERIODS, positionLabel, previousPeriod, SampleNotice, Split, T, Tabs, WinRate, type WebPeriod } from './kit';
import { EvolutionPanel, InsightsPanel, LatestReport, MatchTable, TopChampions } from './parts';

/** Visão geral: identidade da conta, indicadores do período (com comparação) e resumo das outras áreas. */
export function WebOverview() {
  const [period, setPeriod] = useState<WebPeriod>(30);
  const [compareOn, setCompareOn] = useState(true);
  const [view, setView] = useState<'resumo' | 'detalhado'>('resumo');
  return (
    <Page
      eyebrow="Visão geral"
      title="Painel do jogador"
      subtitle="Indicadores calculados sobre as partidas carregadas"
      toolbar={
        <>
          <Tabs value={period} onChange={setPeriod} options={PERIODS} />
          <Tabs value={view} onChange={setView} options={[{ value: 'resumo', label: 'Resumo' }, { value: 'detalhado', label: 'Detalhado' }]} />
          <Button kind="ghost" icon={compareOn ? 'git-compare' : 'git-compare-outline'} label={compareOn ? 'Comparando com o período anterior' : 'Comparar com o período anterior'} onPress={() => setCompareOn((c) => !c)} />
        </>
      }>
      <DataGate>{(d) => <Body data={d} period={period} compareOn={compareOn && period !== 0} detailed={view === 'detalhado'} />}</DataGate>
    </Page>
  );
}

function Body({ data, period, compareOn, detailed }: { data: Derived; period: WebPeriod; compareOn: boolean; detailed: boolean }) {
  const router = useRouter();
  const ms = useMemo(() => inPeriod(data.matches, data.asOf, period), [data, period]);
  const prev = useMemo(() => previousPeriod(data.matches, data.asOf, period), [data, period]);
  const s = useMemo(() => summarize(ms), [ms]);
  const sp = useMemo(() => (compareOn && prev.length ? summarize(prev) : null), [prev, compareOn]);
  const lp = ms.reduce((t, m) => t + (m.lpDelta ?? 0), 0);
  const hasLp = ms.some((m) => m.lpDelta !== undefined);
  const { player } = data;
  const k = (key: string) => {
    const def = metric(key);
    return <Kpi label={def.label} value={def.fmt(def.get(s))} info={def.info} delta={sp ? delta(def, s, sp) : null} hint={!sp ? undefined : undefined} />;
  };

  return (
    <>
      <Panel>
        <View style={styles.hero}>
          <ProfileAvatar name={player.gameName} uri={profileIconUrl(player.profileIconId)} level={player.level} size={72} />
          <View style={{ flex: 1, minWidth: 220, gap: 4 }}>
            <Text style={styles.name}>
              {player.gameName}
              <Text style={styles.tag}> #{player.tagLine}</Text>
            </Text>
            <Text style={styles.meta}>
              {player.region} · Nível {player.level} · {data.source === 'demo' ? 'conta demonstrativa (fictícia)' : 'dados da Riot Games API'}
            </Text>
          </View>
          <View style={styles.rank}>
            {player.rank ? <RankEmblem rank={player.rank} size={64} /> : null}
            <View>
              <Text style={[styles.rankName, { color: player.rank ? TIER_COLOR[player.rank.tier] : colors.textMuted }]}>{player.rank ? rankLabel(player.rank) : 'Sem elo'}</Text>
              <Text style={styles.meta}>
                {player.rank ? `${player.rank.lp} LP` : 'Solo/Duo'}
                {data.peakRank ? ` · melhor: ${rankLabel(data.peakRank)}` : ''}
              </Text>
            </View>
          </View>
        </View>
      </Panel>

      <KpiStrip>
        <Kpi label="Partidas" value={int(s.games)} hint={`${s.wins}V ${s.losses}D`} />
        {k('winRate')}
        {k('kda')}
        {k('csPerMin')}
        {k('goldPerMin')}
        <Kpi label="Dano médio" value={compact(s.avgDamage)} hint={`${int(s.damagePerMin)} por minuto`} delta={sp ? delta(metric('damagePerMin'), s, sp) : null} />
        {k('killParticipation')}
        {hasLp ? <Kpi label="LP no período" value={signed(lp)} accent={lp >= 0 ? colors.good : colors.loss} hint="Solo/Duo" /> : null}
      </KpiStrip>
      {compareOn && prev.length < MIN.compare ? <Text style={styles.note}>Comparação indisponível: o período anterior tem {prev.length} partidas (mínimo {MIN.compare}).</Text> : null}

      <Split>
        <EvolutionPanel data={data} days={period} />
        <Panel title="Principais campeões" subtitle="No período selecionado" padded={false}>
          <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
            <TopChampions matches={ms} />
          </View>
        </Panel>
      </Split>

      <Split>
        <Panel title="Últimas partidas" subtitle="Clique para abrir o relatório" padded={false} right={<Button kind="ghost" label="Histórico completo" onPress={() => router.navigate('/partidas')} />}>
          <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
            <MatchTable matches={ms.slice(0, 10)} asOf={data.asOf} pageSize={10} compact minWidth={560} />
          </View>
        </Panel>
        <View style={{ gap: 20 }}>
          <LatestReport data={data} />
          <InsightsPanel data={data} limit={3} />
        </View>
      </Split>

      {detailed ? <Detailed data={data} ms={ms} /> : null}
    </>
  );
}

function Detailed({ data, ms }: { data: Derived; ms: Derived['matches'] }) {
  const positions = byPosition(ms).filter((p) => p.games > 0);
  const cons = consistency(ms);
  const obj = useMemo(() => {
    const n = ms.length || 1;
    const sum = (f: (m: (typeof ms)[number]) => number) => ms.reduce((t, m) => t + f(m), 0) / n;
    return {
      dragons: sum((m) => m.objectives.dragons),
      enemyDragons: sum((m) => m.objectives.enemyDragons),
      barons: sum((m) => m.objectives.barons),
      towers: sum((m) => m.objectives.towers),
      enemyTowers: sum((m) => m.objectives.enemyTowers),
    };
  }, [ms]);
  return (
    <Cols lg={3} md={1}>
      <Panel title="Por posição" padded={false}>
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <DataTable
            minWidth={300}
            rows={positions}
            rowKey={(p) => p.position}
            columns={[
              { key: 'p', label: 'Posição', flex: 1, render: (p) => <T strong>{positionLabel(p.position)}</T> },
              { key: 'g', label: 'Jogos', width: 56, align: 'right', render: (p) => <T>{p.games}</T> },
              { key: 'w', label: 'Vitórias', width: 100, align: 'right', render: (p) => <WinRate value={p.winRate} games={p.games} /> },
            ]}
          />
        </View>
      </Panel>
      <Panel title="Horários" subtitle="Taxa de vitória por dia e faixa de 3 horas" info="Células com poucas partidas aparecem esmaecidas.">
        {ms.length >= MIN.trend ? <Heatmap cells={heatmap(ms)} /> : <SampleNotice have={ms.length} need={MIN.trend} />}
      </Panel>
      <Panel title="Consistência e objetivos" info="Consistência: quanto o KDA varia entre partidas. Objetivos: médias por partida das equipes.">
        {ms.length >= MIN.trend ? (
          <View style={{ gap: 10 }}>
            <Text style={styles.big}>{cons.score}/100</Text>
            <Text style={styles.meta}>KDA mediano {dec(cons.median)} · desvio-padrão {dec(cons.stdDev)}</Text>
            <View style={styles.objRow}>
              <Text style={styles.meta}>Dragões</Text>
              <T>{`${dec(obj.dragons)} × ${dec(obj.enemyDragons)}`}</T>
            </View>
            <View style={styles.objRow}>
              <Text style={styles.meta}>Torres</Text>
              <T>{`${dec(obj.towers)} × ${dec(obj.enemyTowers)}`}</T>
            </View>
            <View style={styles.objRow}>
              <Text style={styles.meta}>Barões (sua equipe)</Text>
              <T>{dec(obj.barons)}</T>
            </View>
            <Text style={styles.note}>Média por partida, sua equipe × inimiga. Taxa de vitória geral: {pct(summarize(ms).winRate)}.</Text>
          </View>
        ) : (
          <SampleNotice have={ms.length} need={MIN.trend} />
        )}
      </Panel>
    </Cols>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 20 },
  name: { fontFamily: fonts.title, fontSize: 30, color: colors.text },
  tag: { fontFamily: fonts.display, fontSize: 22, color: colors.textMuted },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  rank: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankName: { fontFamily: fonts.title, fontSize: 24 },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  big: { fontFamily: fonts.displayBold, fontSize: 34, color: colors.text },
  objRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.hairline, paddingVertical: 6 },
});
