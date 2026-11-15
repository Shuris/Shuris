import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SourceBadge } from '@/components/SourceBadge';
import { Card, ChampionAvatar, Chip, ChipRow, CONTENT_MAX_WIDTH, EmptyState, MatchRow, Screen, ScreenSkeleton, Segmented, Sheet, SheetOption, WinLossBar } from '@/components/ui';
import { champion, POSITION_LABEL, POSITIONS } from '@/data/champions';
import { usePlayer } from '@/state/PlayerContext';
import { summarize } from '@/stats/aggregate';
import { dec, pct, QUEUE_LABEL, QUEUE_SHORT } from '@/stats/format';
import { colors, space, type } from '@/theme';
import type { Match, Position, QueueType } from '@/types';

type ResultFilter = 'all' | 'win' | 'loss';
type SheetKind = 'champion' | 'position' | 'queue' | 'period' | null;

interface Filters {
  result: ResultFilter;
  championId: string | null;
  position: Position | null;
  queue: QueueType | null;
  days: number | null;
}

const EMPTY: Filters = { result: 'all', championId: null, position: null, queue: null, days: null };
const PERIODS = [
  { value: 7, label: 'Últimos 7 dias' },
  { value: 15, label: 'Últimos 15 dias' },
  { value: 30, label: 'Últimos 30 dias' },
  { value: 90, label: 'Últimos 90 dias' },
  { value: 365, label: 'Último ano' },
];
const QUEUES: QueueType[] = ['SOLO', 'FLEX', 'NORMAL'];

export function MatchesScreen() {
  const { status, data } = usePlayer();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const set = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setSheet(null);
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    const from = filters.days ? data.asOf - filters.days * 86_400_000 : 0;
    return data.matches.filter(
      (m) =>
        (filters.result === 'all' || (filters.result === 'win') === m.win) &&
        (!filters.championId || m.championId === filters.championId) &&
        (!filters.position || m.position === filters.position) &&
        (!filters.queue || m.queue === filters.queue) &&
        m.timestamp > from,
    );
  }, [data, filters]);
  const summary = useMemo(() => summarize(filtered), [filtered]);
  const activeCount = [filters.championId, filters.position, filters.queue, filters.days].filter(Boolean).length + (filters.result !== 'all' ? 1 : 0);

  const renderItem = useCallback(
    ({ item }: { item: Match }) => (
      <MatchRow match={item} asOf={data?.asOf ?? 0} detailed onPress={() => router.push({ pathname: '/partida/[id]', params: { id: item.id } })} />
    ),
    [data?.asOf, router],
  );

  const header = (
    <View style={{ gap: space.md, flex: 1 }}>
      <Segmented
        options={[
          { value: 'all', label: 'Todas' },
          { value: 'win', label: 'Vitórias' },
          { value: 'loss', label: 'Derrotas' },
        ]}
        value={filters.result}
        onChange={(result) => set({ result })}
      />
      <ChipRow>
        <Chip dropdown active={!!filters.championId} label={filters.championId ? champion(filters.championId).name : 'Campeão'} onPress={() => setSheet('champion')} />
        <Chip dropdown active={!!filters.position} label={filters.position ? POSITION_LABEL[filters.position] : 'Posição'} onPress={() => setSheet('position')} />
        <Chip dropdown active={!!filters.queue} label={filters.queue ? QUEUE_SHORT[filters.queue] : 'Modo'} onPress={() => setSheet('queue')} />
        <Chip dropdown active={!!filters.days} label={filters.days ? `${filters.days} dias` : 'Período'} onPress={() => setSheet('period')} />
        {activeCount > 0 ? <Chip icon="close" label="Limpar" onPress={() => setFilters(EMPTY)} /> : null}
      </ChipRow>
    </View>
  );

  return (
    <Screen
      title="Partidas"
      subtitle={data ? (data.source === 'riot' ? `${data.matches.length} partidas reais carregadas` : `Histórico completo · ${data.matches.length} partidas`) : undefined}
      right={<SourceBadge />}
      sticky={header}
      scroll={false}>
      {status === 'loading' ? (
        <View style={styles.pad}>
          <ScreenSkeleton hero={false} cards={3} />
        </View>
      ) : !data ? (
        <View style={styles.pad}>
          <Card>
            <EmptyState icon="search-outline" title="Nenhuma conta carregada" message="Pesquise um jogador na aba Início para ver o histórico de partidas." />
          </Card>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          style={{ flex: 1 }}
          contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + space.xxl, gap: space.sm }]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          windowSize={9}
          ListHeaderComponent={
            filtered.length ? (
              <View style={styles.summary}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text style={type.h3}>
                    {summary.games} {summary.games === 1 ? 'partida' : 'partidas'}
                    {activeCount ? ` · ${activeCount} ${activeCount === 1 ? 'filtro' : 'filtros'}` : ''}
                  </Text>
                  <Text style={type.bodySm}>
                    {pct(summary.winRate)} · {summary.wins}V {summary.losses}D · KDA {dec(summary.kda, 2)}
                  </Text>
                </View>
                <WinLossBar wins={summary.wins} losses={summary.losses} height={4} />
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <Card>
              <EmptyState
                icon="funnel-outline"
                title="Nenhuma partida encontrada"
                message={activeCount ? 'Nenhuma partida corresponde à combinação de filtros selecionada.' : 'Esta conta ainda não tem partidas carregadas.'}
                actionLabel={activeCount ? 'Limpar filtros' : undefined}
                onAction={() => setFilters(EMPTY)}
              />
            </Card>
          }
        />
      )}

      {data ? (
        <>
          <Sheet visible={sheet === 'champion'} title="Campeão" onClose={() => setSheet(null)}>
            <SheetOption label="Todos os campeões" selected={!filters.championId} onPress={() => set({ championId: null })} />
            {[...data.champions]
              .sort((a, b) => b.games - a.games)
              .map((c) => (
                <SheetOption
                  key={c.championId}
                  left={<ChampionAvatar id={c.championId} size={30} />}
                  label={champion(c.championId).name}
                  detail={`${c.games} partidas`}
                  selected={filters.championId === c.championId}
                  onPress={() => set({ championId: c.championId })}
                />
              ))}
          </Sheet>
          <Sheet visible={sheet === 'position'} title="Posição" onClose={() => setSheet(null)}>
            <SheetOption label="Todas as posições" selected={!filters.position} onPress={() => set({ position: null })} />
            {POSITIONS.map((p) => (
              <SheetOption
                key={p}
                label={POSITION_LABEL[p]}
                detail={`${data.matches.filter((m) => m.position === p).length} partidas`}
                selected={filters.position === p}
                onPress={() => set({ position: p })}
              />
            ))}
          </Sheet>
          <Sheet visible={sheet === 'queue'} title="Modo de jogo" onClose={() => setSheet(null)}>
            <SheetOption label="Todos os modos" selected={!filters.queue} onPress={() => set({ queue: null })} />
            {QUEUES.map((q) => (
              <SheetOption
                key={q}
                label={QUEUE_LABEL[q]}
                detail={`${data.matches.filter((m) => m.queue === q).length} partidas`}
                selected={filters.queue === q}
                onPress={() => set({ queue: q })}
              />
            ))}
          </Sheet>
          <Sheet visible={sheet === 'period'} title="Período" onClose={() => setSheet(null)}>
            <SheetOption label="Todo o histórico" selected={!filters.days} onPress={() => set({ days: null })} />
            {PERIODS.map((p) => (
              <SheetOption key={p.value} label={p.label} selected={filters.days === p.value} onPress={() => set({ days: p.value })} />
            ))}
          </Sheet>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.lg, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  summary: { gap: 8, marginBottom: space.sm, paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
});
