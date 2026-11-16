import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthPrompt } from '@/components/auth/AccountCard';
import { DIFFICULTY_COLOR, MatchupEditor } from '@/components/matchups/MatchupEditor';
import { Card, ChampionAvatar, EmptyState, PressableScale, Screen, ScreenSkeleton, SectionHeader } from '@/components/ui';
import { champion } from '@/data/champions';
import { useMatchups } from '@/hooks/useMatchups';
import { DIFFICULTY_LABEL, type MatchupNote } from '@/services/matchupNotes';
import { usePlayer } from '@/state/PlayerContext';
import { relativeDay } from '@/stats/format';
import { colors, fonts, radius, space, type } from '@/theme';
import type { Match } from '@/types';

interface Pair {
  championId: string;
  opponentId: string;
  games: number;
  wins: number;
}

/** Confrontos (seu campeão × adversário de rota) mais frequentes nas partidas carregadas. */
function pairsOf(matches: Match[]): Pair[] {
  const map = new Map<string, Pair>();
  for (const m of matches) {
    const k = `${m.championId}|${m.opponentChampionId}`;
    const p = map.get(k) ?? { championId: m.championId, opponentId: m.opponentChampionId, games: 0, wins: 0 };
    p.games++;
    if (m.win) p.wins++;
    map.set(k, p);
  }
  return [...map.values()].sort((a, b) => b.games - a.games);
}

export const recordText = (p?: { games: number; wins: number }) => (p && p.games ? `${p.wins}V ${p.games - p.wins}D` : 'sem partidas registradas');

export function MatchupNotebookScreen() {
  const { data } = usePlayer();
  const mu = useMatchups();
  const [editing, setEditing] = useState<{ championId: string; opponentId: string } | null>(null);
  const pairs = useMemo(() => (data ? pairsOf(data.matches) : []), [data]);
  const pairOf = (c: string, o: string) => pairs.find((p) => p.championId === c && p.opponentId === o);
  const suggestions = pairs.filter((p) => p.games >= 2 && !mu.find(p.championId, p.opponentId)).slice(0, 8);

  if (!mu.available) {
    return (
      <Screen title="Caderno de matchups" back>
        <AuthPrompt />
      </Screen>
    );
  }
  return (
    <Screen title="Caderno de matchups" subtitle={mu.owner === 'demo' ? 'Demonstração · salvo só neste aparelho' : 'Salvo na sua conta'} back>
      {mu.loading ? (
        <ScreenSkeleton cards={2} hero={false} />
      ) : (
        <>
          {mu.error ? (
            <Card>
              <EmptyState icon="cloud-offline-outline" title="Caderno indisponível" message={mu.error} />
            </Card>
          ) : null}
          <Card>
            <SectionHeader title="Suas anotações" subtitle={mu.notes.length ? `${mu.notes.length} ${mu.notes.length === 1 ? 'confronto anotado' : 'confrontos anotados'}` : 'O que você aprendeu em cada confronto'} />
            {mu.notes.length ? (
              <View style={{ gap: space.sm }}>
                {mu.notes.map((n) => (
                  <NoteRow key={`${n.championId}|${n.opponentId}`} note={n} record={recordText(pairOf(n.championId, n.opponentId))} asOf={data?.asOf ?? Date.now()} onPress={() => setEditing(n)} />
                ))}
              </View>
            ) : (
              <EmptyState icon="book-outline" title="Caderno vazio" message="Anote o que funciona (e o que não funciona) contra cada campeão. As anotações aparecem também no relatório das partidas." />
            )}
          </Card>
          {suggestions.length ? (
            <Card>
              <SectionHeader title="Confrontos frequentes" subtitle="Sem anotação ainda · tirados das suas partidas" />
              <View style={{ gap: space.sm }}>
                {suggestions.map((p) => (
                  <PressableScale key={`${p.championId}|${p.opponentId}`} onPress={() => setEditing(p)} style={styles.row} accessibilityRole="button" accessibilityLabel={`Anotar ${champion(p.championId).name} contra ${champion(p.opponentId).name}`}>
                    <Pairing championId={p.championId} opponentId={p.opponentId} />
                    <View style={{ flex: 1 }}>
                      <Text style={type.h3} numberOfLines={1}>
                        {champion(p.championId).name} × {champion(p.opponentId).name}
                      </Text>
                      <Text style={type.bodySm}>
                        {p.games} partidas · {recordText(p)}
                      </Text>
                    </View>
                    <Ionicons name="create-outline" size={18} color={colors.accentSoft} />
                  </PressableScale>
                ))}
              </View>
            </Card>
          ) : null}
        </>
      )}
      <MatchupEditor
        matchups={mu}
        championId={editing?.championId ?? ''}
        opponentId={editing?.opponentId ?? null}
        record={editing ? recordText(pairOf(editing.championId, editing.opponentId)) : undefined}
        onClose={() => setEditing(null)}
      />
    </Screen>
  );
}

export function Pairing({ championId, opponentId, size = 36 }: { championId: string; opponentId: string; size?: number }) {
  return (
    <View style={{ width: size * 1.6, height: size }}>
      <ChampionAvatar id={championId} size={size} />
      <View style={{ position: 'absolute', left: size * 0.6, top: 0, borderRadius: size * 0.3, borderWidth: 2, borderColor: colors.surfaceAlt }}>
        <ChampionAvatar id={opponentId} size={size - 4} />
      </View>
    </View>
  );
}

export function NoteRow({ note: n, record, asOf, onPress }: { note: MatchupNote; record: string; asOf: number; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={`Anotação: ${champion(n.championId).name} contra ${champion(n.opponentId).name}`}>
      <Pairing championId={n.championId} opponentId={n.opponentId} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[type.h3, { flexShrink: 1 }]} numberOfLines={1}>
            {champion(n.championId).name} × {champion(n.opponentId).name}
          </Text>
          <View style={[styles.pill, { backgroundColor: `${DIFFICULTY_COLOR[n.difficulty]}22` }]}>
            <Text style={[styles.pillText, { color: DIFFICULTY_COLOR[n.difficulty] }]}>{DIFFICULTY_LABEL[n.difficulty]}</Text>
          </View>
        </View>
        {n.note ? (
          <Text style={[type.bodySm, { color: colors.textSecondary }]} numberOfLines={2}>
            {n.note}
          </Text>
        ) : null}
        <Text style={[type.bodySm, { fontSize: 11 }]}>
          {record} · editado {relativeDay(n.updatedAt, Math.max(asOf, n.updatedAt)).toLowerCase()}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md },
  pill: { borderRadius: radius.pill, paddingHorizontal: 7, height: 18, justifyContent: 'center' },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 10 },
});
