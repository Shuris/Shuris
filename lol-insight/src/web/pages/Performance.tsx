import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BarChart, Heatmap, LineChart } from '@/components/charts';
import { champion, POSITION_LABEL, POSITIONS } from '@/data/champions';
import type { Derived } from '@/state/PlayerContext';
import { byChampion, byPosition, newestFirst, summarize, withinDays, type Summary } from '@/stats/aggregate';
import { byBuckets, byResult, championPositionMatrix, lastN, metricSeries, objectivesReport, winRateText, type SeriesMetric } from '@/stats/cross';
import { dec, int, pct } from '@/stats/format';
import { consistency, heatmap } from '@/stats/timeseries';
import { colors, fonts } from '@/theme';
import type { Position, QueueType } from '@/types';

import {
  ChampCell,
  Cols,
  DataGate,
  DataTable,
  Dropdown,
  DURATION_BUCKETS,
  inPeriod,
  Kpi,
  KpiStrip,
  METRICS,
  MIN,
  MiniBar,
  Page,
  Panel,
  PERIODS,
  SampleNotice,
  Split,
  T,
  Tabs,
  WinRate,
  type WebPeriod,
} from './kit';

type Queue = 'ALL' | QueueType;
type Pos = 'ALL' | Position;
interface Filters {
  period: WebPeriod;
  last: number;
  queue: Queue;
  position: Pos;
  champion: string;
}

/** Central de análise: filtros combinados, evolução de métricas e cruzamentos com aviso de amostra. */
export function WebPerformance() {
  const [f, setF] = useState<Filters>({ period: 90, last: 0, queue: 'ALL', position: 'ALL', champion: 'ALL' });
  const set = <K extends keyof Filters>(k: K) => (v: Filters[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <DataGateWithToolbar f={f} set={set} />
  );
}

function DataGateWithToolbar({ f, set }: { f: Filters; set: <K extends keyof Filters>(k: K) => (v: Filters[K]) => void }) {
  return (
    <Page eyebrow="Desempenho" title="Central de análise" subtitle="Combine filtros para cruzar campeões, posições, horários e duração das partidas">
      <DataGate>
        {(d) => (
          <>
            <Toolbar data={d} f={f} set={set} />
            <Body data={d} f={f} />
          </>
        )}
      </DataGate>
    </Page>
  );
}

function Toolbar({ data, f, set }: { data: Derived; f: Filters; set: <K extends keyof Filters>(k: K) => (v: Filters[K]) => void }) {
  const champs = useMemo(() => byChampion(data.matches).sort((a, b) => b.games - a.games), [data]);
  return (
    <View style={styles.toolbar}>
      <Tabs value={f.period} onChange={set('period')} options={PERIODS} />
      <Dropdown label="Últimos" value={f.last} onChange={set('last')} options={[{ value: 0, label: 'Todos os jogos' }, ...[10, 20, 50, 100].map((n) => ({ value: n, label: `${n} jogos` }))]} />
      <Dropdown label="Fila" value={f.queue} onChange={set('queue')} options={[{ value: 'ALL', label: 'Todas' }, { value: 'SOLO', label: 'Solo/Duo' }, { value: 'FLEX', label: 'Flex' }, { value: 'NORMAL', label: 'Normal' }]} />
      <Dropdown label="Posição" value={f.position} onChange={set('position')} options={[{ value: 'ALL', label: 'Todas' }, ...POSITIONS.map((p) => ({ value: p, label: POSITION_LABEL[p] }))]} />
      <Dropdown label="Campeão" value={f.champion} onChange={set('champion')} width={220} options={[{ value: 'ALL', label: 'Todos' }, ...champs.map((c) => ({ value: c.championId, label: `${champion(c.championId).name} (${c.games})` }))]} />
    </View>
  );
}

function applyFilters(data: Derived, f: Filters) {
  let ms = data.matches.filter((m) => (f.queue === 'ALL' || m.queue === f.queue) && (f.position === 'ALL' || m.position === f.position) && (f.champion === 'ALL' || m.championId === f.champion));
  ms = inPeriod(ms, data.asOf, f.period);
  if (f.last) ms = newestFirst(ms).slice(0, f.last);
  return ms;
}

function Body({ data, f }: { data: Derived; f: Filters }) {
  const ms = useMemo(() => applyFilters(data, f), [data, f]);
  const s = useMemo(() => summarize(ms), [ms]);
  if (!ms.length) return <Panel><SampleNotice have={0} need={1} /></Panel>;
  return (
    <>
      <Text style={styles.count}>
        {ms.length} partidas analisadas · {s.wins}V {s.losses}D
      </Text>
      <KpiStrip>
        {METRICS.map((m) => (
          <Kpi key={m.key} label={m.label} value={m.fmt(m.get(s))} info={m.info} />
        ))}
      </KpiStrip>
      <MetricEvolution matches={ms} />
      <Split ratio={1}>
        <PositionPanel ms={ms} />
        <ChampionPanel ms={ms} />
      </Split>
      <MatrixPanel ms={ms} />
      <Cols lg={2} md={1}>
        <Panel title="Desempenho por horário" subtitle="Taxa de vitória por dia da semana e faixa de 3 horas" info="Cada célula mostra a taxa de vitória; células com poucas partidas ficam esmaecidas.">
          {ms.length >= MIN.trend ? <Heatmap cells={heatmap(ms)} /> : <SampleNotice have={ms.length} need={MIN.trend} />}
        </Panel>
        <DurationPanel ms={ms} />
      </Cols>
      <Cols lg={3} md={1}>
        <ResultPanel ms={ms} />
        <ObjectivesPanel ms={ms} />
        <ConsistencyPanel ms={ms} />
      </Cols>
      <Split ratio={1}>
        <LastNPanel ms={applyFilters(data, { ...f, period: 0, last: 0 })} />
        <PeriodCompare data={data} f={f} />
      </Split>
    </>
  );
}

const SERIES: Array<{ value: SeriesMetric | 'wr'; label: string }> = [
  { value: 'kda', label: 'KDA' },
  { value: 'wr', label: 'Vitórias' },
  { value: 'csPerMin', label: 'CS/min' },
  { value: 'goldPerMin', label: 'Ouro/min' },
  { value: 'damagePerMin', label: 'Dano/min' },
  { value: 'killParticipation', label: 'Participação' },
  { value: 'visionPerMin', label: 'Visão/min' },
];

function MetricEvolution({ matches }: { matches: Derived['matches'] }) {
  const [m, setM] = useState<SeriesMetric | 'wr'>('kda');
  const series = useMemo(() => {
    if (m === 'wr') {
      const s = metricSeries(matches, 'kda');
      // Taxa de vitória móvel de 10 partidas, em %, sobre as mesmas partidas.
      const wins = s.points.map((p) => (p.win ? 1 : 0));
      const points = s.points.map((p, i) => {
        const w = wins.slice(Math.max(0, i - 9), i + 1);
        const y = (w.reduce((a: number, b) => a + b, 0) / w.length) * 100;
        return { ...p, y, detail: `${dec(y, 0)}% nas últimas ${w.length} partidas` };
      });
      return { points, moving: [] as number[], average: (wins.reduce((a: number, b) => a + b, 0) / Math.max(1, wins.length)) * 100, label: 'Vitórias', fmt: (v: number) => `${dec(v, 0)}%` };
    }
    return metricSeries(matches, m);
  }, [matches, m]);
  return (
    <Panel title="Evolução das métricas" subtitle="Valor por partida, em ordem cronológica, com média móvel de 5 partidas" right={<Tabs value={m} onChange={setM} options={SERIES} />}>
      {series.points.length >= MIN.trend ? (
        <LineChart
          points={series.points}
          height={280}
          yFormat={series.fmt}
          label={series.label}
          overlay={series.moving.length ? { values: series.moving, label: 'média móvel (5)', color: colors.gold } : undefined}
          reference={{ y: m === 'wr' ? 50 : series.average, label: m === 'wr' ? '50%' : 'média do filtro' }}
          resultDots
        />
      ) : (
        <SampleNotice have={series.points.length} need={MIN.trend} />
      )}
    </Panel>
  );
}

const statCols = (max: (k: keyof Summary) => number) => [
  { key: 'g', label: 'Jogos', width: 60, align: 'right' as const, render: (r: Summary) => <T>{r.games}</T>, sort: (r: Summary) => r.games },
  { key: 'wr', label: 'Vitórias', width: 124, align: 'right' as const, render: (r: Summary) => <WinRate value={r.winRate} games={r.games} />, sort: (r: Summary) => r.winRate },
  { key: 'kda', label: 'KDA', width: 64, align: 'right' as const, render: (r: Summary) => <T>{dec(r.kda, 2)}</T>, sort: (r: Summary) => r.kda },
  { key: 'cs', label: 'CS/min', width: 70, align: 'right' as const, render: (r: Summary) => <T>{dec(r.csPerMin, 1)}</T>, sort: (r: Summary) => r.csPerMin },
  {
    key: 'dpm',
    label: 'Dano/min',
    width: 120,
    render: (r: Summary) => (
      <View style={{ width: '100%', gap: 3 }}>
        <T>{int(r.damagePerMin)}</T>
        <MiniBar value={r.damagePerMin} max={max('damagePerMin')} />
      </View>
    ),
    sort: (r: Summary) => r.damagePerMin,
  },
  { key: 'kp', label: 'Part.', width: 60, align: 'right' as const, render: (r: Summary) => <T>{pct(r.killParticipation)}</T>, sort: (r: Summary) => r.killParticipation },
];

function PositionPanel({ ms }: { ms: Derived['matches'] }) {
  const rows = byPosition(ms).filter((p) => p.games > 0);
  const max = (k: keyof Summary) => Math.max(...rows.map((r) => r[k] as number));
  return (
    <Panel title="Desempenho por posição" padded={false}>
      <View style={styles.tableWrap}>
        <DataTable minWidth={560} rows={rows} rowKey={(r) => r.position} initialSort={{ key: 'g', dir: 'desc' }} columns={[{ key: 'p', label: 'Posição', flex: 1, render: (r) => <T strong>{POSITION_LABEL[r.position]}</T> }, ...statCols(max)]} />
      </View>
    </Panel>
  );
}

function ChampionPanel({ ms }: { ms: Derived['matches'] }) {
  const router = useRouter();
  const rows = byChampion(ms);
  const max = (k: keyof Summary) => Math.max(...rows.map((r) => r[k] as number));
  return (
    <Panel title="Desempenho por campeão" padded={false}>
      <View style={styles.tableWrap}>
        <DataTable
          minWidth={600}
          pageSize={8}
          rows={rows}
          rowKey={(r) => r.championId}
          initialSort={{ key: 'g', dir: 'desc' }}
          onRowPress={(r) => router.push({ pathname: '/campeao/[id]', params: { id: r.championId } })}
          columns={[{ key: 'c', label: 'Campeão', flex: 1, render: (r) => <ChampCell id={r.championId} size={26} />, sort: (r) => champion(r.championId).name }, ...statCols(max)]}
        />
      </View>
    </Panel>
  );
}

function MatrixPanel({ ms }: { ms: Derived['matches'] }) {
  const rows = championPositionMatrix(ms, 10);
  const positions = POSITIONS.filter((p) => rows.some((r) => r.cells[p]));
  return (
    <Panel title="Taxa de vitória por campeão e posição" subtitle="Cruzamento dos 10 campeões mais jogados" info={`Células com menos de ${MIN.cell} partidas mostram só o número de jogos.`} padded={false}>
      <View style={styles.tableWrap}>
        <DataTable
          minWidth={180 + positions.length * 120}
          rows={rows}
          rowKey={(r) => r.championId}
          columns={[
            { key: 'c', label: 'Campeão', flex: 1, render: (r) => <ChampCell id={r.championId} size={26} sub={`${r.total.games} jogos · ${winRateText(r.total)}`} /> },
            ...positions.map((p) => ({
              key: p,
              label: POSITION_LABEL[p],
              width: 120,
              align: 'center' as const,
              render: (r: (typeof rows)[number]) => {
                const c = r.cells[p];
                if (!c) return <T muted>—</T>;
                if (c.games < MIN.cell) return <T muted>{`${c.games} jogo${c.games > 1 ? 's' : ''}`}</T>;
                const wr = c.wins / c.games;
                return (
                  <View style={[styles.heatCell, { backgroundColor: wr >= 0.5 ? `rgba(61,139,255,${0.12 + (wr - 0.5) * 0.8})` : `rgba(229,96,106,${0.12 + (0.5 - wr) * 0.8})` }]}>
                    <Text style={styles.heatText}>{pct(wr)}</Text>
                    <Text style={styles.heatSub}>{c.games} jogos</Text>
                  </View>
                );
              },
            })),
          ]}
        />
      </View>
    </Panel>
  );
}

function DurationPanel({ ms }: { ms: Derived['matches'] }) {
  const rows = byBuckets(ms, DURATION_BUCKETS);
  const bars = rows.map((r) => ({
    label: r.label.replace(' min', '').replace(' ou mais', '+'),
    value: r.summary.games >= MIN.cell ? r.summary.kda : 0,
    valueLabel: r.summary.games >= MIN.cell ? dec(r.summary.kda, 1) : `${r.summary.games} jogos`,
    title: r.label,
    detail: r.summary.games >= MIN.cell ? `KDA ${dec(r.summary.kda, 2)} · ${pct(r.summary.winRate)} de vitórias · ${r.summary.games} partidas` : `Só ${r.summary.games} partidas: amostra insuficiente`,
    color: colors.series1,
    muted: r.summary.games < MIN.cell,
  }));
  return (
    <Panel title="KDA por duração da partida" subtitle="Faixas com menos de 5 partidas ficam sem valor" info="Ajuda a ver se o jogador rende mais em partidas curtas ou longas.">
      <BarChart bars={bars} height={190} />
      <View style={{ marginTop: 12, gap: 4 }}>
        {rows.map((r) => (
          <View key={r.key} style={styles.kv}>
            <Text style={styles.kvLabel}>{r.label}</Text>
            <T>{r.summary.games >= MIN.cell ? `${pct(r.summary.winRate)} de vitórias · ${r.summary.games} jogos` : `${r.summary.games} jogos`}</T>
          </View>
        ))}
      </View>
    </Panel>
  );
}

function ResultPanel({ ms }: { ms: Derived['matches'] }) {
  const { win, loss } = byResult(ms);
  const enough = win.games >= MIN.cell && loss.games >= MIN.cell;
  const rows: Array<[string, (s: Summary) => string]> = [
    ['CS/min', (s) => dec(s.csPerMin, 1)],
    ['Ouro/min', (s) => int(s.goldPerMin)],
    ['Dano/min', (s) => int(s.damagePerMin)],
    ['Mortes', (s) => dec(s.avgDeaths, 1)],
    ['Visão/min', (s) => dec(s.visionPerMin, 2)],
  ];
  return (
    <Panel title="Farm e recursos por resultado" info="Compara as médias nas vitórias e nas derrotas.">
      {enough ? (
        <View style={{ gap: 4 }}>
          <View style={styles.kv}>
            <Text style={styles.kvHead}>Métrica</Text>
            <Text style={[styles.kvHead, styles.right, { color: colors.accentSoft }]}>Vitórias ({win.games})</Text>
            <Text style={[styles.kvHead, styles.right, { color: colors.loss }]}>Derrotas ({loss.games})</Text>
          </View>
          {rows.map(([label, f]) => (
            <View key={label} style={styles.kv}>
              <Text style={styles.kvLabel}>{label}</Text>
              <T cell>{f(win)}</T>
              <T cell>{f(loss)}</T>
            </View>
          ))}
        </View>
      ) : (
        <SampleNotice have={Math.min(win.games, loss.games)} need={MIN.cell} what="partidas de cada resultado" />
      )}
    </Panel>
  );
}

function ObjectivesPanel({ ms }: { ms: Derived['matches'] }) {
  const o = objectivesReport(ms);
  const ft = (c: { games: number; wins: number }) => (c.games >= MIN.cell ? `${pct(c.wins / c.games)} (${c.games})` : `${c.games} jogos`);
  return (
    <Panel title="Controle de objetivos" info="Médias por partida (sua equipe × inimiga) e taxa de vitória conforme a primeira torre.">
      <View style={{ gap: 4 }}>
        {[
          ['Dragões', `${dec(o.avg.dragons)} × ${dec(o.avg.enemyDragons)}`],
          ['Barões', `${dec(o.avg.barons)} × ${dec(o.avg.enemyBarons)}`],
          ['Arautos (sua equipe)', dec(o.avg.heralds)],
          ['Torres', `${dec(o.avg.towers)} × ${dec(o.avg.enemyTowers)}`],
          ['Vitórias com a 1ª torre', ft(o.firstTower.ours)],
          ['Vitórias sem a 1ª torre', ft(o.firstTower.theirs)],
          ['Sua participação nos objetivos', o.participation === null ? 'não informado' : pct(o.participation)],
        ].map(([k, v]) => (
          <View key={k} style={styles.kv}>
            <Text style={styles.kvLabel}>{k}</Text>
            <T>{v}</T>
          </View>
        ))}
      </View>
    </Panel>
  );
}

function ConsistencyPanel({ ms }: { ms: Derived['matches'] }) {
  if (ms.length < MIN.trend)
    return (
      <Panel title="Consistência">
        <SampleNotice have={ms.length} need={MIN.trend} />
      </Panel>
    );
  const c = consistency(ms);
  return (
    <Panel title="Consistência" info="Quanto o KDA varia de uma partida para outra. 100 = muito estável.">
      <Text style={styles.big}>{c.score}/100</Text>
      <Text style={styles.kvLabel}>
        KDA mediano {dec(c.median)} · desvio-padrão {dec(c.stdDev)}
      </Text>
      <View style={{ marginTop: 12 }}>
        <MiniBar value={c.score} max={100} color={c.score >= 60 ? colors.good : c.score >= 40 ? colors.warning : colors.loss} />
      </View>
    </Panel>
  );
}

function LastNPanel({ ms }: { ms: Derived['matches'] }) {
  const rows = lastN(ms);
  return (
    <Panel title="Últimos 10, 20, 50 e 100 jogos" subtitle="Com os filtros de fila, posição e campeão (sem o período)" padded={false}>
      <View style={styles.tableWrap}>
        <DataTable
          minWidth={520}
          rows={rows}
          rowKey={(r) => String(r.n)}
          columns={[
            { key: 'n', label: 'Janela', flex: 1, render: (r) => <T strong>{r.available < r.n ? `${r.n} jogos (só ${r.available})` : `Últimos ${r.n}`}</T> },
            { key: 'wr', label: 'Vitórias', width: 120, align: 'right', render: (r) => <WinRate value={r.summary.winRate} games={r.available} /> },
            { key: 'kda', label: 'KDA', width: 64, align: 'right', render: (r) => <T>{dec(r.summary.kda, 2)}</T> },
            { key: 'cs', label: 'CS/min', width: 70, align: 'right', render: (r) => <T>{dec(r.summary.csPerMin, 1)}</T> },
            { key: 'kp', label: 'Part.', width: 60, align: 'right', render: (r) => <T>{pct(r.summary.killParticipation)}</T> },
          ]}
        />
      </View>
    </Panel>
  );
}

function PeriodCompare({ data, f }: { data: Derived; f: Filters }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const base = data.matches.filter((m) => (f.queue === 'ALL' || m.queue === f.queue) && (f.position === 'ALL' || m.position === f.position) && (f.champion === 'ALL' || m.championId === f.champion));
  const a = summarize(withinDays(base, data.asOf, days));
  const b = summarize(withinDays(base, data.asOf, days, days));
  const enough = a.games >= MIN.compare && b.games >= MIN.compare;
  return (
    <Panel title="Comparação entre períodos" subtitle={`Últimos ${days} dias × os ${days} dias anteriores`} right={<Tabs value={days} onChange={setDays} options={[{ value: 7, label: '7 d' }, { value: 30, label: '30 d' }, { value: 90, label: '90 d' }]} />}>
      {enough ? (
        <View style={{ gap: 4 }}>
          <View style={styles.kv}>
            <Text style={styles.kvHead}>Métrica</Text>
            <Text style={[styles.kvHead, styles.right]}>Atual ({a.games})</Text>
            <Text style={[styles.kvHead, styles.right]}>Anterior ({b.games})</Text>
            <Text style={[styles.kvHead, styles.right]}>Diferença</Text>
          </View>
          {METRICS.map((m) => {
            const va = m.get(a);
            const vb = m.get(b);
            const better = m.better === 'up' ? va > vb : va < vb;
            return (
              <View key={m.key} style={styles.kv}>
                <Text style={styles.kvLabel}>{m.label}</Text>
                <T cell>{m.fmt(va)}</T>
                <T cell muted>{m.fmt(vb)}</T>
                <T cell color={Math.abs(va - vb) < 1e-9 ? colors.textMuted : better ? colors.good : colors.loss}>{m.diff(va, vb)}</T>
              </View>
            );
          })}
        </View>
      ) : (
        <SampleNotice have={Math.min(a.games, b.games)} need={MIN.compare} what="partidas em cada período" />
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', zIndex: 10 },
  count: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.textMuted },
  tableWrap: { paddingHorizontal: 12, paddingBottom: 12 },
  heatCell: { borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10, alignItems: 'center', minWidth: 76 },
  heatText: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.text },
  heatSub: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textSecondary },
  kv: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  kvLabel: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  kvHead: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textMuted },
  big: { fontFamily: fonts.displayBold, fontSize: 36, color: colors.text },
  right: { textAlign: 'right' },
});
