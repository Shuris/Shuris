import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { RadarChart } from '@/components/charts';
import { REGIONS } from '@/components/SearchBar';
import { Card, Chip, EmptyState, FadeIn, haptic, ProfileAvatar, RankEmblem, Screen, SectionHeader, Sheet, SheetOption } from '@/components/ui';
import { profileIconUrl } from '@/data/champions';
import { describeError, ServiceError } from '@/services';
import { parseRiotId } from '@/services/PlayerDataSource';
import { usePlayer } from '@/state/PlayerContext';
import { compareSides } from '@/stats/compare';
import { rankLabel, TIER_COLOR } from '@/stats/rank';
import { colors, fonts, radius, space, type } from '@/theme';
import type { PlayerBundle, Region } from '@/types';

const FRIEND = '#E3A857';

/** Comparar com um amigo: carrega outro Riot ID e coloca os dois lado a lado. */
export function CompareScreen() {
  const { data, dataSource, settings, suggestions } = usePlayer();
  const [text, setText] = useState('');
  const [region, setRegion] = useState<Region>(data?.player.region ?? 'BR');
  const [regionOpen, setRegionOpen] = useState(false);
  const [friend, setFriend] = useState<PlayerBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ServiceError | null>(null);
  const polls = useRef(0);

  const load = async (gameName: string, tagLine: string | undefined, r: Region, quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setError(null);
      polls.current = 0;
    }
    try {
      const b = await dataSource.loadAccount({ gameName, tagLine, region: r }, { count: settings.matchCount });
      if (data && b.player.id === data.player.id && b.source === data.source) throw new ServiceError('INVALID_RIOT_ID', 'Esse é o jogador que você já está vendo. Digite o Riot ID de um amigo.');
      setFriend(b);
      haptic.success();
    } catch (e) {
      if (!quiet) setError(e instanceof ServiceError ? e : new ServiceError('UNKNOWN', 'Não foi possível carregar o jogador.'));
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  // Dados reais: as partidas do amigo são baixadas aos poucos; atualiza enquanto sincroniza.
  useEffect(() => {
    const s = friend?.sync?.state;
    if (!friend || (s !== 'syncing' && s !== 'waiting_rate_limit') || polls.current > 20) return;
    const t = setTimeout(() => {
      polls.current++;
      void load(friend.player.gameName, friend.player.tagLine, friend.player.region, true);
    }, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend]);

  const cmp = useMemo(() => {
    if (!data || !friend) return null;
    return compareSides({ name: 'Você', matches: data.matches, rank: data.player.rank }, { name: friend.player.gameName, matches: friend.matches, rank: friend.player.rank });
  }, [data, friend]);

  const others = suggestions.filter((s) => !data || s.gameName !== data.player.gameName || s.region !== data.player.region);
  const submit = () => {
    const { gameName, tagLine } = parseRiotId(text);
    if (!gameName) return setError(new ServiceError('INVALID_RIOT_ID', 'Digite o Riot ID do seu amigo (Nome#TAG).'));
    void load(gameName, tagLine, region);
  };

  if (!data) {
    return (
      <Screen title="Comparar" back>
        <Card>
          <EmptyState icon="people-outline" title="Carregue seu perfil primeiro" message="A comparação usa as suas partidas e as do seu amigo. Pesquise o seu Riot ID na Início." />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Comparar com um amigo" subtitle={`${data.player.gameName}#${data.player.tagLine} contra outro jogador`} back>
      <Card>
        <SectionHeader title="Amigo" subtitle={data.source === 'demo' ? 'Escolha uma conta demonstrativa ou digite o Riot ID' : 'Digite o Riot ID completo (Nome#TAG)'} />
        <View style={styles.inputRow}>
          <Pressable onPress={() => setRegionOpen(true)} style={styles.region} accessibilityRole="button" accessibilityLabel={`Região ${region}`}>
            <Text style={styles.regionText}>{region}</Text>
            <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            placeholder="Nome#TAG"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Riot ID do amigo"
            style={styles.input}
          />
          <Pressable onPress={submit} style={styles.go} accessibilityRole="button" accessibilityLabel="Comparar">
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="git-compare-outline" size={18} color="#fff" />}
          </Pressable>
        </View>
        {others.length ? (
          <View style={styles.chips}>
            {others.map((s) => (
              <Chip
                key={`${s.gameName}#${s.tagLine}@${s.region}`}
                label={`${s.gameName}#${s.tagLine}`}
                icon="person-outline"
                active={friend?.player.gameName === s.gameName}
                onPress={() => {
                  setText(`${s.gameName}#${s.tagLine}`);
                  setRegion(s.region);
                  void load(s.gameName, s.tagLine, s.region);
                }}
              />
            ))}
          </View>
        ) : null}
        {error ? (
          <View style={styles.error}>
            <Ionicons name={describeError(error.code).icon} size={15} color={colors.loss} />
            <Text style={[type.bodySm, { flex: 1, color: colors.textSecondary }]}>{error.message}</Text>
          </View>
        ) : null}
      </Card>

      {friend && cmp ? (
        <FadeIn trigger={friend.player.id} style={{ gap: space.xl }}>
          <Card>
            <View style={styles.versus}>
              <Side name="Você" sub={`${data.player.gameName}#${data.player.tagLine}`} icon={data.player.profileIconId} rank={data.player.rank} color={colors.accentSoft} games={cmp.sample[0]} />
              <Text style={styles.vs}>VS</Text>
              <Side name={friend.player.gameName} sub={`#${friend.player.tagLine} · ${friend.player.region}`} icon={friend.player.profileIconId} rank={friend.player.rank} color={FRIEND} games={cmp.sample[1]} />
            </View>
            {friend.sync && friend.sync.state !== 'idle' && friend.sync.loaded < friend.sync.available ? (
              <Text style={[type.bodySm, { marginTop: space.md, textAlign: 'center' }]}>
                Baixando partidas do amigo: {friend.sync.loaded} de {friend.sync.available}. A comparação se atualiza sozinha.
              </Text>
            ) : null}
            {cmp.verdicts.length ? (
              <View style={{ gap: 6, marginTop: space.lg }}>
                {cmp.verdicts.map((v) => (
                  <View key={v} style={styles.verdict}>
                    <Ionicons name={v.startsWith('Você') ? 'arrow-up-circle' : 'arrow-down-circle'} size={16} color={v.startsWith('Você') ? colors.good : FRIEND} />
                    <Text style={[type.body, { flex: 1 }]}>{v}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>

          <Card>
            <SectionHeader title="Lado a lado" subtitle={`Suas ${cmp.sample[0]} partidas contra as ${cmp.sample[1]} de ${friend.player.gameName}`} />
            <View style={{ gap: 2 }}>
              <View style={[styles.row, { paddingVertical: 4 }]}>
                <Text style={[type.label, { flex: 1 }]}>Métrica</Text>
                <Text style={[type.label, styles.cell, { color: colors.accentSoft }]}>Você</Text>
                <Text style={[type.label, styles.cell, { color: FRIEND }]} numberOfLines={1}>
                  {friend.player.gameName}
                </Text>
              </View>
              {cmp.rows.map((r) => (
                <View key={r.key} style={styles.row}>
                  <Text style={[type.bodySm, { flex: 1, color: colors.textSecondary }]}>{r.label}</Text>
                  <Text style={[styles.value, styles.cell, r.better === 'a' && { color: colors.accentSoft }]}>{r.text[0]}</Text>
                  <Text style={[styles.value, styles.cell, r.better === 'b' && { color: FRIEND }]}>{r.text[1]}</Text>
                </View>
              ))}
            </View>
          </Card>

          <Card>
            <SectionHeader title="Identidade competitiva" subtitle={`Notas de 0 a 100, as duas comparadas à referência do ${data.player.rank ? rankLabel(data.player.rank).split(' ')[0] : 'Ouro'}`} />
            {cmp.radar ? (
              <>
                <RadarChart axes={cmp.radar.axes.map((a, i) => ({ ...a, value: cmp.radar!.a[i] }))} compare={{ values: cmp.radar.b, color: FRIEND }} size={300} />
                <View style={styles.legend}>
                  <Text style={[styles.legendItem, { color: colors.accentSoft }]}>● Você</Text>
                  <Text style={[styles.legendItem, { color: FRIEND }]}>● {friend.player.gameName}</Text>
                </View>
              </>
            ) : (
              <EmptyState icon="analytics-outline" title="Amostra pequena" message="O radar precisa de pelo menos 20 partidas de cada jogador." />
            )}
          </Card>
        </FadeIn>
      ) : !loading ? (
        <Card>
          <EmptyState icon="people-outline" title="Escolha um amigo" message="Compare taxa de vitória, farm, dano, visão e o radar de identidade com qualquer jogador." />
        </Card>
      ) : null}

      <Sheet visible={regionOpen} title="Região do amigo" onClose={() => setRegionOpen(false)}>
        {REGIONS.map((r) => (
          <SheetOption
            key={r.value}
            label={r.label}
            detail={r.value}
            selected={r.value === region}
            onPress={() => {
              setRegion(r.value);
              setRegionOpen(false);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}

function Side({ name, sub, icon, rank, color, games }: { name: string; sub: string; icon: number; rank: PlayerBundle['player']['rank']; color: string; games: number }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <ProfileAvatar name={sub.replace('#', '')} uri={profileIconUrl(icon)} size={52} />
      <Text style={[type.h3, { color }]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={type.bodySm} numberOfLines={1}>
        {sub}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {rank ? <RankEmblem rank={rank} size={22} /> : null}
        <Text style={[type.bodySm, { color: rank ? TIER_COLOR[rank.tier] : colors.textMuted }]}>{rank ? rankLabel(rank) : 'Sem elo'}</Text>
      </View>
      <Text style={[type.bodySm, { fontSize: 11 }]}>{games} partidas</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  region: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 44, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.surfaceHigh },
  regionText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text },
  input: { flex: 1, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, color: colors.text, fontFamily: fonts.body, fontSize: 14 },
  go: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  error: { flexDirection: 'row', gap: 8, marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.lossDim },
  versus: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  vs: { fontFamily: fonts.title, fontSize: 20, color: colors.gold },
  verdict: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  cell: { width: 82, textAlign: 'right' },
  value: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.textSecondary },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: space.lg, marginTop: space.sm },
  legendItem: { fontFamily: fonts.bodySemi, fontSize: 12 },
});
