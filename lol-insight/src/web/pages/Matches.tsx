import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { champion, POSITION_LABEL, POSITIONS } from '@/data/champions';
import type { Derived } from '@/state/PlayerContext';
import { byChampion, summarize } from '@/stats/aggregate';
import { dec, pct, signed } from '@/stats/format';
import { colors, fonts, radius } from '@/theme';
import type { Position, QueueType } from '@/types';

import { Button, css, DataGate, Dropdown, DURATION_BUCKETS, inPeriod, Page, Panel, PERIODS, type WebPeriod } from './kit';
import { MatchTable } from './parts';

interface F {
  q: string;
  champion: string;
  position: 'ALL' | Position;
  result: 'ALL' | 'WIN' | 'LOSS';
  period: WebPeriod;
  queue: 'ALL' | QueueType;
  duration: string;
}
const EMPTY: F = { q: '', champion: 'ALL', position: 'ALL', result: 'ALL', period: 0, queue: 'ALL', duration: 'ALL' };

/** Histórico completo e pesquisável, com filtros combinados. */
export function WebMatches() {
  const [f, setF] = useState<F>(EMPTY);
  const set = <K extends keyof F>(k: K) => (v: F[K]) => setF((x) => ({ ...x, [k]: v }));
  const active = (Object.keys(EMPTY) as Array<keyof F>).filter((k) => f[k] !== EMPTY[k]).length;
  return (
    <Page eyebrow="Partidas" title="Histórico de partidas" subtitle="Pesquise e filtre; clique numa partida para o relatório completo">
      <DataGate>
        {(d) => (
          <>
            <View style={styles.toolbar}>
              <View style={styles.search}>
                <Ionicons name="search" size={14} color={colors.textMuted} />
                <TextInput value={f.q} onChangeText={set('q')} placeholder="Campeão ou adversário" placeholderTextColor={colors.textMuted} accessibilityLabel="Pesquisar partidas" style={[styles.input, css({ outlineStyle: 'none' })]} />
              </View>
              <Dropdown label="Campeão" value={f.champion} onChange={set('champion')} width={220} options={[{ value: 'ALL', label: 'Todos' }, ...byChampion(d.matches).sort((a, b) => b.games - a.games).map((c) => ({ value: c.championId, label: `${champion(c.championId).name} (${c.games})` }))]} />
              <Dropdown label="Posição" value={f.position} onChange={set('position')} options={[{ value: 'ALL', label: 'Todas' }, ...POSITIONS.map((p) => ({ value: p, label: POSITION_LABEL[p] }))]} />
              <Dropdown label="Resultado" value={f.result} onChange={set('result')} options={[{ value: 'ALL', label: 'Todos' }, { value: 'WIN', label: 'Vitórias' }, { value: 'LOSS', label: 'Derrotas' }]} />
              <Dropdown label="Período" value={f.period} onChange={set('period')} options={PERIODS} />
              <Dropdown label="Modo" value={f.queue} onChange={set('queue')} options={[{ value: 'ALL', label: 'Todos' }, { value: 'SOLO', label: 'Solo/Duo' }, { value: 'FLEX', label: 'Flex' }, { value: 'NORMAL', label: 'Normal' }]} />
              <Dropdown label="Duração" value={f.duration} onChange={set('duration')} options={[{ value: 'ALL', label: 'Todas' }, ...DURATION_BUCKETS.map((b) => ({ value: b.key, label: b.label }))]} />
              {active ? <Button kind="ghost" icon="close" label={`Limpar filtros (${active})`} onPress={() => setF(EMPTY)} /> : null}
            </View>
            <List data={d} f={f} />
          </>
        )}
      </DataGate>
    </Page>
  );
}

function List({ data, f }: { data: Derived; f: F }) {
  const ms = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const dur = DURATION_BUCKETS.find((b) => b.key === f.duration);
    return inPeriod(data.matches, data.asOf, f.period).filter(
      (m) =>
        (f.champion === 'ALL' || m.championId === f.champion) &&
        (f.position === 'ALL' || m.position === f.position) &&
        (f.result === 'ALL' || (f.result === 'WIN') === m.win) &&
        (f.queue === 'ALL' || m.queue === f.queue) &&
        (!dur || dur.test(m)) &&
        (!q || champion(m.championId).name.toLowerCase().includes(q) || champion(m.opponentChampionId).name.toLowerCase().includes(q)),
    );
  }, [data, f]);
  const s = summarize(ms);
  const lp = ms.reduce((t, m) => t + (m.lpDelta ?? 0), 0);
  return (
    <Panel padded={false}>
      <View style={styles.summary}>
        <Text style={styles.sumText}>
          <Text style={styles.sumStrong}>{ms.length}</Text> partidas · {s.wins}V {s.losses}D · {ms.length ? pct(s.winRate) : '—'} de vitórias · KDA {ms.length ? dec(s.kda, 2) : '—'}
          {ms.some((m) => m.lpDelta !== undefined) ? ` · ${signed(lp)} LP` : ''}
        </Text>
        {data.ignored && (data.ignored.otherModes || data.ignored.remakes) ? (
          <Text style={styles.sumNote}>
            Fora da análise: {data.ignored.otherModes} de outros modos e {data.ignored.remakes} canceladas (remake).
          </Text>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
        <MatchTable matches={ms} asOf={data.asOf} pageSize={30} minWidth={860} />
      </View>
    </Panel>
  );
}


const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', zIndex: 10 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, minWidth: 220 },
  input: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 13 },
  summary: { padding: 18, gap: 4, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  sumText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textSecondary },
  sumStrong: { fontFamily: fonts.bodyBold, color: colors.text },
  sumNote: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
});
