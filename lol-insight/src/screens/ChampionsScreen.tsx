import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SourceBadge } from '@/components/SourceBadge';
import { Card, ChampionAvatar, Chip, ChipRow, EmptyState, FadeIn, Screen, ScreenSkeleton, SectionHeader, WinLossBar } from '@/components/ui';
import { champion, POSITION_LABEL } from '@/data/champions';
import { usePlayer } from '@/state/PlayerContext';
import { bestChampions, sortChampions, type ChampionSort, type ChampionStats } from '@/stats/aggregate';
import { ago, dec, int, pct } from '@/stats/format';
import { colors, fonts, radius, space, type } from '@/theme';

const SORTS: Array<{ value: ChampionSort; label: string }> = [
  { value: 'games', label: 'Mais jogados' },
  { value: 'winRate', label: 'Maior win rate' },
  { value: 'kda', label: 'Melhor KDA' },
  { value: 'wins', label: 'Mais vitórias' },
];

export function ChampionsScreen() {
  const { status, data } = usePlayer();
  const router = useRouter();
  const [sort, setSort] = useState<ChampionSort>('games');
  const sorted = useMemo(() => (data ? sortChampions(data.champions, sort) : []), [data, sort]);
  const best = useMemo(() => (data ? bestChampions(data.champions) : []), [data]);
  const open = (id: string) => router.push({ pathname: '/campeao/[id]', params: { id } });

  return (
    <Screen title="Campeões" subtitle={data ? `${data.champions.length} campeões jogados em ${data.summary.games} partidas` : undefined} right={<SourceBadge />}>
      {status === 'loading' ? (
        <ScreenSkeleton hero={false} cards={3} />
      ) : !data ? (
        <Card>
          <EmptyState icon="search-outline" title="Nenhuma conta carregada" message="Pesquise um jogador na aba Início para ver os campeões." />
        </Card>
      ) : !sorted.length && !data.mastery.length ? (
        <Card>
          <EmptyState icon="shield-outline" title="Nenhum campeão" message="Esta conta ainda não possui partidas carregadas." />
        </Card>
      ) : (
        <>
          {data.mastery.length ? (
            <View>
              <SectionHeader title="Maestria" subtitle="Campeões com maior domínio, segundo a Riot (carreira inteira)" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingRight: space.lg }}>
                {data.mastery.map((m) => (
                  <Pressable key={m.championId} onPress={() => open(m.championId)} accessibilityRole="button" accessibilityLabel={`${champion(m.championId).name}: maestria ${m.level}`} style={({ pressed }) => [styles.mastery, pressed && { opacity: 0.8 }]}>
                    <ChampionAvatar id={m.championId} size={48} />
                    <Text style={[type.h3, { marginTop: 6 }]} numberOfLines={1}>
                      {champion(m.championId).name}
                    </Text>
                    <Text style={styles.masteryLevel}>Nível {m.level}</Text>
                    <Text style={type.bodySm}>{int(m.points)} pts</Text>
                    <Text style={styles.meta}>{ago(m.lastPlayed)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {best.length ? (
            <View>
              <SectionHeader title="Seus melhores campeões" subtitle="Taxa de vitória ponderada pela amostra (mín. 8 partidas)" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingRight: space.lg }}>
                {best.map((c, i) => (
                  <BestCard key={c.championId} stats={c} place={i + 1} onPress={() => open(c.championId)} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {sorted.length ? (
          <View>
            <SectionHeader title="Biblioteca" subtitle={data.source === 'riot' ? `Desempenho nas ${data.summary.games} partidas analisadas` : undefined} />
            <ChipRow>
              {SORTS.map((s) => (
                <Chip key={s.value} label={s.label} active={s.value === sort} onPress={() => setSort(s.value)} />
              ))}
            </ChipRow>
            <FadeIn trigger={sort} style={{ gap: space.sm, marginTop: space.md }}>
              {sorted.map((c, i) => (
                <ChampionCard key={c.championId} stats={c} rank={i + 1} highlight={sort} onPress={() => open(c.championId)} />
              ))}
            </FadeIn>
          </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function BestCard({ stats, place, onPress }: { stats: ChampionStats; place: number; onPress: () => void }) {
  const c = champion(stats.championId);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${place}º melhor campeão: ${c.name}`} style={({ pressed }) => [styles.best, pressed && { opacity: 0.8 }]}>
      <View style={[styles.bestGlow, { backgroundColor: c.color }]} />
      <View style={styles.place}>
        <Ionicons name="trophy" size={11} color={colors.gold} />
        <Text style={styles.placeText}>{place}º</Text>
      </View>
      <ChampionAvatar id={c.id} size={56} ring={place === 1 ? colors.gold : undefined} />
      <Text style={[type.h3, { marginTop: space.sm }]} numberOfLines={1}>
        {c.name}
      </Text>
      <Text style={styles.bestWr}>{pct(stats.winRate)}</Text>
      <Text style={type.bodySm}>
        {stats.games} partidas · KDA {dec(stats.kda, 1)}
      </Text>
    </Pressable>
  );
}

function ChampionCard({ stats, rank, highlight, onPress }: { stats: ChampionStats; rank: number; highlight: ChampionSort; onPress: () => void }) {
  const c = champion(stats.championId);
  const on = (k: ChampionSort) => (k === highlight ? { color: colors.text } : null);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${c.name}: ${stats.games} partidas, ${pct(stats.winRate)} de vitórias`} style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfaceHigh }]}>
      <Text style={styles.rank}>{rank}</Text>
      <ChampionAvatar id={c.id} size={50} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={type.h3} numberOfLines={1}>
            {c.name}
          </Text>
          <Text style={styles.meta}>{POSITION_LABEL[stats.mainPosition]}</Text>
        </View>
        <WinLossBar wins={stats.wins} losses={stats.losses} height={5} />
        <View style={styles.statsRow}>
          <Stat label="Partidas" value={`${stats.games}`} style={on('games')} />
          <Stat label="Vitórias" value={pct(stats.winRate)} style={on('winRate')} sub={`${stats.wins}V`} subStyle={on('wins')} />
          <Stat label="KDA" value={dec(stats.kda, 2)} style={on('kda')} />
          <Stat label="Sequência" value={`${stats.bestWinStreak}V`} />
        </View>
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
    </Pressable>
  );
}

function Stat({ label, value, sub, style, subStyle }: { label: string; value: string; sub?: string; style?: object | null; subStyle?: object | null }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.statValue, style]} numberOfLines={1}>
        {value}
        {sub ? <Text style={[styles.meta, subStyle]}> {sub}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  best: {
    width: 148,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    gap: 2,
  },
  bestGlow: { position: 'absolute', top: -50, right: -50, width: 130, height: 130, borderRadius: 65, opacity: 0.16 },
  place: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 3 },
  placeText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.gold },
  bestWr: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.text, letterSpacing: -0.5 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mastery: { width: 116, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 1 },
  masteryLevel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.gold },
  rank: { width: 16, textAlign: 'center', fontFamily: fonts.display, fontSize: 12, color: colors.textMuted },
  meta: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  statsRow: { flexDirection: 'row', gap: 6 },
  statLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  statValue: { fontFamily: fonts.display, fontSize: 13, color: colors.textSecondary },
});
