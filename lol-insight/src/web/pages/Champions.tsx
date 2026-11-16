import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ChampionBackdrop } from '@/components/ui';
import { champion, CLASS_LABEL, POSITION_LABEL, POSITIONS } from '@/data/champions';
import type { Derived } from '@/state/PlayerContext';
import { bestChampions, byChampion, type ChampionStats } from '@/stats/aggregate';
import { compact, dec, int, pct } from '@/stats/format';
import { colors, fonts, radius } from '@/theme';
import type { MasteryEntry, Position } from '@/types';

import { Button, ChampCell, css, DataGate, DataTable, Dropdown, inPeriod, MIN, MiniBar, Page, Panel, PERIODS, T, Tabs, WinRate, type Column, type WebPeriod } from './kit';

const MAX_COMPARE = 4;
const COMPARE_COLORS = [colors.series1, colors.gold, colors.good, '#C77DFF'];

/** Biblioteca de campeões: tabela completa, destaques e comparação de até 4 campeões. */
export function WebChampions() {
  const [period, setPeriod] = useState<WebPeriod>(0);
  const [q, setQ] = useState('');
  const [pos, setPos] = useState<'ALL' | Position>('ALL');
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_COMPARE ? p : [...p, id]));
  return (
    <Page
      eyebrow="Campeões"
      title="Biblioteca de campeões"
      subtitle="Todos os campeões jogados nas partidas carregadas. Marque até 4 para comparar."
      toolbar={
        <>
          <Tabs value={period} onChange={setPeriod} options={PERIODS} />
          <Dropdown label="Posição" value={pos} onChange={setPos} options={[{ value: 'ALL', label: 'Todas' }, ...POSITIONS.map((p) => ({ value: p, label: POSITION_LABEL[p] }))]} />
          <View style={styles.search}>
            <Ionicons name="search" size={14} color={colors.textMuted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Filtrar campeão" placeholderTextColor={colors.textMuted} accessibilityLabel="Filtrar campeão" style={[styles.searchInput, css({ outlineStyle: 'none' })]} />
          </View>
          {picked.length ? <Button kind="ghost" icon="close" label={`Limpar comparação (${picked.length})`} onPress={() => setPicked([])} /> : null}
        </>
      }>
      <DataGate>{(d) => <Body data={d} period={period} q={q} pos={pos} picked={picked} toggle={toggle} />}</DataGate>
    </Page>
  );
}

function Body({ data, period, q, pos, picked, toggle }: { data: Derived; period: WebPeriod; q: string; pos: 'ALL' | Position; picked: string[]; toggle: (id: string) => void }) {
  const router = useRouter();
  const ms = useMemo(() => inPeriod(data.matches, data.asOf, period).filter((m) => pos === 'ALL' || m.position === pos), [data, period, pos]);
  const all = useMemo(() => byChampion(ms), [ms]);
  const masteryOf = useMemo(() => new Map(data.mastery.map((m) => [m.championId, m])), [data]);
  const rows = all.filter((c) => !q.trim() || champion(c.championId).name.toLowerCase().includes(q.trim().toLowerCase()));
  const best = bestChampions(all, 8, 3);
  const maxDmg = Math.max(...all.map((c) => c.avgDamage), 1);

  const cols: Column<ChampionStats>[] = [
    {
      key: 'sel',
      label: '',
      width: 44,
      render: (c) => {
        const on = picked.includes(c.championId);
        return (
          <Pressable onPress={() => toggle(c.championId)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`Comparar ${champion(c.championId).name}`} hitSlop={8} style={css({ cursor: 'pointer' })}>
            <Ionicons name={on ? 'checkbox' : 'square-outline'} size={18} color={on ? colors.accentSoft : colors.textMuted} />
          </Pressable>
        );
      },
    },
    { key: 'c', label: 'Campeão', flex: 2, render: (c) => <ChampCell id={c.championId} sub={champion(c.championId).classes.map((k) => CLASS_LABEL[k]).join(' · ')} />, sort: (c) => champion(c.championId).name },
    {
      key: 'mastery',
      label: 'Maestria',
      width: 140,
      align: 'right',
      info: data.source === 'demo' ? 'Na demonstração, a maestria é fictícia e proporcional às partidas.' : 'Champion-Mastery-V4 da Riot.',
      render: (c) => {
        const m = masteryOf.get(c.championId);
        return m ? <T>{`Nv ${m.level} · ${compact(m.points)}`}</T> : <T muted>—</T>;
      },
      sort: (c) => masteryOf.get(c.championId)?.points ?? 0,
    },
    { key: 'g', label: 'Jogos', width: 62, align: 'right', render: (c) => <T strong>{c.games}</T>, sort: (c) => c.games },
    { key: 'wr', label: 'Vitórias', width: 130, align: 'right', render: (c) => <WinRate value={c.winRate} games={c.games} min={MIN.champion} />, sort: (c) => c.winRate },
    { key: 'kda', label: 'KDA', width: 64, align: 'right', render: (c) => <T>{dec(c.kda, 2)}</T>, sort: (c) => c.kda },
    { key: 'cs', label: 'CS/min', width: 70, align: 'right', render: (c) => <T>{dec(c.csPerMin, 1)}</T>, sort: (c) => c.csPerMin },
    {
      key: 'dmg',
      label: 'Dano médio',
      width: 130,
      render: (c) => (
        <View style={{ width: '100%', gap: 3 }}>
          <T>{compact(c.avgDamage)}</T>
          <MiniBar value={c.avgDamage} max={maxDmg} />
        </View>
      ),
      sort: (c) => c.avgDamage,
    },
    { key: 'pos', label: 'Posição', width: 92, render: (c) => <T>{POSITION_LABEL[c.mainPosition]}</T>, sort: (c) => c.mainPosition },
    { key: 'streak', label: 'Melhor série', width: 96, align: 'right', render: (c) => <T>{c.bestWinStreak ? `${c.bestWinStreak}V` : '—'}</T>, sort: (c) => c.bestWinStreak },
  ];

  return (
    <>
      {best.length ? (
        <View style={styles.bestRow}>
          {best.map((c, i) => (
            <Pressable key={c.championId} onPress={() => router.push({ pathname: '/campeao/[id]', params: { id: c.championId } })} style={[styles.best, css({ cursor: 'pointer' })]} accessibilityRole="link" accessibilityLabel={`${champion(c.championId).name}: ${pct(c.winRate)}`}>
              <ChampionBackdrop id={c.championId} height={150}>
                <View style={{ padding: 16, gap: 2 }}>
                  <Text style={styles.bestRank}>{i + 1}º melhor desempenho</Text>
                  <Text style={styles.bestName}>{champion(c.championId).name}</Text>
                  <Text style={styles.bestMeta}>
                    {pct(c.winRate)} de vitórias · {c.games} jogos · KDA {dec(c.kda, 2)}
                  </Text>
                </View>
              </ChampionBackdrop>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Panel title={`${rows.length} campeões`} subtitle="Clique numa linha para a análise do campeão" padded={false} info="Os melhores desempenhos usam um limite inferior de confiança da taxa de vitória (mínimo de 8 partidas), para não premiar sorte em poucas partidas.">
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <DataTable
            columns={cols}
            rows={rows}
            rowKey={(c) => c.championId}
            initialSort={{ key: 'g', dir: 'desc' }}
            onRowPress={(c) => router.push({ pathname: '/campeao/[id]', params: { id: c.championId } })}
            rowLabel={(c) => `${champion(c.championId).name}, ${c.games} jogos`}
            minWidth={980}
            pageSize={30}
            empty="Nenhum campeão com estes filtros."
          />
        </View>
      </Panel>
      {picked.length >= 2 ? <Compare stats={picked.map((id) => all.find((c) => c.championId === id)).filter((x): x is ChampionStats => !!x)} mastery={masteryOf} /> : picked.length === 1 ? <Text style={styles.hint}>Marque mais um campeão para comparar.</Text> : null}
    </>
  );
}

function Compare({ stats, mastery }: { stats: ChampionStats[]; mastery: Map<string, MasteryEntry> }) {
  const rows: Array<{ label: string; get: (c: ChampionStats) => number; fmt: (v: number) => string; lowerBetter?: boolean }> = [
    { label: 'Partidas', get: (c) => c.games, fmt: (v) => int(v) },
    { label: 'Taxa de vitória', get: (c) => c.winRate, fmt: (v) => pct(v, 1) },
    { label: 'KDA', get: (c) => c.kda, fmt: (v) => dec(v, 2) },
    { label: 'Mortes por partida', get: (c) => c.avgDeaths, fmt: (v) => dec(v, 1), lowerBetter: true },
    { label: 'CS/min', get: (c) => c.csPerMin, fmt: (v) => dec(v, 1) },
    { label: 'Ouro/min', get: (c) => c.goldPerMin, fmt: (v) => int(v) },
    { label: 'Dano/min', get: (c) => c.damagePerMin, fmt: (v) => int(v) },
    { label: 'Participação em abates', get: (c) => c.killParticipation, fmt: (v) => pct(v) },
    { label: 'Visão/min', get: (c) => c.visionPerMin, fmt: (v) => dec(v, 2) },
    { label: 'Maestria (pontos)', get: (c) => mastery.get(c.championId)?.points ?? 0, fmt: (v) => (v ? compact(v) : '—') },
  ];
  const small = stats.filter((c) => c.games < MIN.champion);
  return (
    <Panel title="Comparação de campeões" subtitle="Valores lado a lado; a barra mostra a posição relativa entre os escolhidos">
      <View style={styles.cmpHead}>
        <View style={{ width: 200 }} />
        {stats.map((c, i) => (
          <View key={c.championId} style={styles.cmpCol}>
            <View style={[styles.dot, { backgroundColor: COMPARE_COLORS[i] }]} />
            <ChampCell id={c.championId} size={26} />
          </View>
        ))}
      </View>
      {rows.map((r) => {
        const vals = stats.map(r.get);
        const max = Math.max(...vals, 1e-9);
        const bestV = r.lowerBetter ? Math.min(...vals) : Math.max(...vals);
        return (
          <View key={r.label} style={styles.cmpRow}>
            <Text style={styles.cmpLabel}>{r.label}</Text>
            {stats.map((c, i) => (
              <View key={c.championId} style={[styles.cmpCol, { gap: 4, alignItems: 'stretch' }]}>
                <Text style={[styles.cmpVal, vals[i] === bestV && stats.length > 1 ? { color: colors.text } : null]}>{r.fmt(vals[i])}</Text>
                <MiniBar value={vals[i]} max={max} color={COMPARE_COLORS[i]} />
              </View>
            ))}
          </View>
        );
      })}
      {small.length ? <Text style={styles.hint}>Atenção: {small.map((c) => champion(c.championId).name).join(', ')} tem menos de {MIN.champion} partidas; a comparação é indicativa.</Text> : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, minWidth: 200 },
  searchInput: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 13 },
  bestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  best: { flexGrow: 1, flexBasis: 280, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.hairline },
  bestRank: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 1, color: colors.gold, textTransform: 'uppercase' },
  bestName: { fontFamily: fonts.title, fontSize: 24, color: colors.text },
  bestMeta: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary },
  hint: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, marginTop: 8 },
  cmpHead: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  cmpRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  cmpLabel: { width: 200, fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  cmpCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 },
  cmpVal: { fontFamily: fonts.display, fontSize: 15, color: colors.textSecondary },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
