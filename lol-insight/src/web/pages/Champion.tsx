import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LineChart } from '@/components/charts';
import { DIFFICULTY_COLOR, MatchupEditor } from '@/components/matchups/MatchupEditor';
import { ChampionAvatar, ChampionBackdrop } from '@/components/ui';
import { champion, CLASS_LABEL, POSITION_LABEL } from '@/data/champions';
import { useMatchups } from '@/hooks/useMatchups';
import { DIFFICULTY_LABEL } from '@/services/matchupNotes';
import type { Derived } from '@/state/PlayerContext';
import { byPosition, matchups, streaks, summarize, type MatchupStats } from '@/stats/aggregate';
import { metricSeries } from '@/stats/cross';
import { compact, dec, int, pct } from '@/stats/format';
import { cumulativeWinRate } from '@/stats/timeseries';
import { colors, fonts } from '@/theme';

import { Button, ChampCell, DataGate, DataTable, delta, Kpi, KpiStrip, metric, MIN, Page, Panel, SampleNotice, Split, T, Tabs, WinRate, type Column } from './kit';
import { MatchTable } from './parts';

/** Página do campeão: desempenho, evolução, posições, matchups (com o caderno) e partidas. */
export function WebChampion() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = champion(id);
  const router = useRouter();
  return (
    <Page eyebrow="Campeão" title={c.name} subtitle={c.title} actions={<Button kind="ghost" icon="arrow-back" label="Biblioteca" onPress={() => router.navigate('/campeoes')} />}>
      <DataGate>{(d) => <Body data={d} id={id} />}</DataGate>
    </Page>
  );
}

function Body({ data, id }: { data: Derived; id: string }) {
  const c = champion(id);
  const list = useMemo(() => data.matches.filter((m) => m.championId === id), [data, id]);
  const s = useMemo(() => summarize(list), [list]);
  const all = data.summary;
  const st = streaks(list);
  const m = data.mastery.find((x) => x.championId === id);
  if (!list.length) return <Panel><SampleNotice have={0} need={1} what={`partidas com ${c.name}`} /></Panel>;
  const vsAll = (key: string) => delta(metric(key), s, all, 'média geral');
  return (
    <>
      <View style={styles.hero}>
        <ChampionBackdrop id={id} height={220}>
          <View style={styles.heroInner}>
            <ChampionAvatar id={id} size={72} ring={colors.gold} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.heroName}>{c.name}</Text>
              <Text style={styles.heroMeta}>
                {c.classes.map((k) => CLASS_LABEL[k]).join(' · ')} · {list.length} partidas · {s.wins}V {s.losses}D
              </Text>
              {m ? (
                <Text style={styles.heroMeta}>
                  Maestria nível {m.level} · {compact(m.points)} pontos{data.source === 'demo' ? ' (fictícia)' : ''}
                </Text>
              ) : null}
            </View>
          </View>
        </ChampionBackdrop>
      </View>
      <KpiStrip>
        <Kpi label="Taxa de vitória" value={pct(s.winRate, 1)} delta={list.length >= MIN.champion ? vsAll('winRate') : null} hint={list.length < MIN.champion ? 'amostra pequena' : undefined} />
        <Kpi label="KDA" value={dec(s.kda, 2)} delta={list.length >= MIN.champion ? vsAll('kda') : null} />
        <Kpi label="CS/min" value={dec(s.csPerMin, 1)} delta={list.length >= MIN.champion ? vsAll('csPerMin') : null} />
        <Kpi label="Dano médio" value={compact(s.avgDamage)} hint={`${int(s.damagePerMin)}/min`} />
        <Kpi label="Ouro/min" value={int(s.goldPerMin)} />
        <Kpi label="Participação" value={pct(s.killParticipation)} />
        <Kpi label="Melhor série" value={st.longestWin ? `${st.longestWin}V` : '—'} hint={`maior sequência de derrotas: ${st.longestLoss}`} />
      </KpiStrip>
      <Text style={styles.note}>As setas comparam com a sua média geral em todos os campeões.</Text>
      <Split>
        <Evolution list={list} />
        <Panel title="Por posição" padded={false}>
          <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
            <DataTable
              minWidth={280}
              rows={byPosition(list).filter((p) => p.games > 0)}
              rowKey={(p) => p.position}
              columns={[
                { key: 'p', label: 'Posição', flex: 1, render: (p) => <T strong>{POSITION_LABEL[p.position]}</T> },
                { key: 'g', label: 'Jogos', width: 56, align: 'right', render: (p) => <T>{p.games}</T> },
                { key: 'w', label: 'Vitórias', width: 110, align: 'right', render: (p) => <WinRate value={p.winRate} games={p.games} /> },
              ]}
            />
          </View>
        </Panel>
      </Split>
      <Matchups list={list} championId={id} />
      <Panel title="Partidas" padded={false}>
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <MatchTable matches={list} asOf={data.asOf} pageSize={15} />
        </View>
      </Panel>
    </>
  );
}

function Evolution({ list }: { list: Derived['matches'] }) {
  const [m, setM] = useState<'wr' | 'kda' | 'csPerMin'>('wr');
  const series = useMemo(() => {
    if (m === 'wr') return { points: cumulativeWinRate(list), fmt: (v: number) => `${Math.round(v)}%`, overlay: undefined, ref: 50 };
    const s = metricSeries(list, m);
    return { points: s.points, fmt: s.fmt, overlay: { values: s.moving, label: 'média móvel (5)', color: colors.gold }, ref: s.average };
  }, [list, m]);
  return (
    <Panel title="Evolução individual" right={<Tabs value={m} onChange={setM} options={[{ value: 'wr', label: 'Vitórias' }, { value: 'kda', label: 'KDA' }, { value: 'csPerMin', label: 'CS/min' }]} />}>
      {list.length >= MIN.champion ? (
        <LineChart points={series.points} height={240} yFormat={series.fmt} overlay={series.overlay} reference={{ y: series.ref, label: m === 'wr' ? '50%' : 'média' }} resultDots={m !== 'wr'} />
      ) : (
        <SampleNotice have={list.length} need={MIN.champion} />
      )}
    </Panel>
  );
}

function Matchups({ list, championId }: { list: Derived['matches']; championId: string }) {
  const mu = useMatchups();
  const [editing, setEditing] = useState<string | null>(null);
  const rows = matchups(list);
  const enough = rows.filter((r) => r.games >= MIN.matchup);
  const best = [...enough].sort((a, b) => b.winRate - a.winRate || b.games - a.games).slice(0, 3);
  const worst = [...enough].sort((a, b) => a.winRate - b.winRate || b.games - a.games).slice(0, 3);
  const cols: Column<MatchupStats>[] = [
    { key: 'o', label: 'Adversário', flex: 2, render: (r) => <ChampCell id={r.opponentId} size={26} sub={`${r.games} partidas`} />, sort: (r) => champion(r.opponentId).name },
    { key: 'wr', label: 'Vitórias', width: 130, align: 'right', render: (r) => <WinRate value={r.winRate} games={r.games} min={MIN.matchup} />, sort: (r) => r.winRate },
    { key: 'kda', label: 'KDA', width: 64, align: 'right', render: (r) => <T>{dec(r.kda, 2)}</T>, sort: (r) => r.kda },
    {
      key: 'note',
      label: 'Caderno',
      flex: 2,
      render: (r) => {
        const n = mu.find(championId, r.opponentId);
        return n ? (
          <Text numberOfLines={1} style={styles.noteText}>
            <Text style={{ color: DIFFICULTY_COLOR[n.difficulty] }}>{DIFFICULTY_LABEL[n.difficulty]} · </Text>
            {n.note || 'sem texto'}
          </Text>
        ) : (
          <T muted>{mu.available ? 'clique para anotar' : '—'}</T>
        );
      },
    },
  ];
  const mini = (title: string, data: MatchupStats[], good: boolean) => (
    <Panel title={title} style={{ flexGrow: 1, flexBasis: 320 }}>
      {data.length ? (
        data.map((r) => (
          <View key={r.opponentId} style={styles.muRow}>
            <ChampCell id={r.opponentId} size={26} sub={`${r.wins}V ${r.losses}D · KDA ${dec(r.kda, 1)}`} />
            <Text style={[styles.muWr, { color: good ? colors.accentSoft : colors.loss }]}>{pct(r.winRate)}</Text>
          </View>
        ))
      ) : (
        <SampleNotice have={0} need={MIN.matchup} what="partidas em algum confronto" />
      )}
    </Panel>
  );
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
        {mini('Melhores matchups', best, true)}
        {mini('Piores matchups', worst, false)}
      </View>
      <Panel title="Todos os confrontos" subtitle={`Contra o oponente direto da rota · mínimo de ${MIN.matchup} partidas para destacar`} padded={false}>
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <DataTable columns={cols} rows={rows} rowKey={(r) => r.opponentId} initialSort={{ key: 'wr', dir: 'desc' }} onRowPress={mu.available ? (r) => setEditing(r.opponentId) : undefined} minWidth={620} pageSize={12} />
        </View>
        <MatchupEditor matchups={mu} championId={championId} opponentId={editing} onClose={() => setEditing(null)} record={editing ? `${rows.find((r) => r.opponentId === editing)?.wins ?? 0}V ${rows.find((r) => r.opponentId === editing)?.losses ?? 0}D` : undefined} />
      </Panel>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.hairline },
  heroInner: { flexDirection: 'row', alignItems: 'center', gap: 18, padding: 22 },
  heroName: { fontFamily: fonts.title, fontSize: 34, color: colors.text },
  heroMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: -8 },
  muRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  muWr: { fontFamily: fonts.displayBold, fontSize: 18 },
  noteText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary },
});

