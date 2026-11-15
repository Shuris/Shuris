import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RadarChart } from '@/components/charts';
import { REGIONS } from '@/components/SearchBar';
import { Card, ChampionAvatar, EmptyState, Meter, ProfileAvatar, RankEmblem, Screen, ScreenSkeleton, SectionHeader, StatTile, TileGrid } from '@/components/ui';
import { champion, POSITION_LABEL, profileIconUrl } from '@/data/champions';
import { usePlayer, type Derived } from '@/state/PlayerContext';
import { bestChampions, byPosition, matchKda, wilsonLower } from '@/stats/aggregate';
import { compact, dateShort, dec, int, pct } from '@/stats/format';
import type { TraitKey } from '@/stats/identity';
import { rankLabel, rankToAbsolute, TIER_COLOR } from '@/stats/rank';
import { colors, fonts, radius, space, type } from '@/theme';
import type { Rank } from '@/types';

export function ProfileScreen() {
  const { status, data } = usePlayer();
  return (
    <Screen title="Perfil" subtitle="Identidade competitiva e carreira">
      {status === 'loading' || !data ? <ScreenSkeleton cards={3} /> : <Content data={data} />}
    </Screen>
  );
}

function Content({ data }: { data: Derived }) {
  const router = useRouter();
  const { player, summary: s, matches } = data;

  const mostPlayed = useMemo(() => [...data.champions].sort((a, b) => b.games - a.games)[0], [data]);
  const bestPosition = useMemo(
    () =>
      byPosition(matches)
        .filter((p) => p.games >= 5)
        .sort((a, b) => wilsonLower(b.wins, b.games) - wilsonLower(a.wins, a.games))[0],
    [matches],
  );
  const bestKdaMatch = useMemo(() => [...matches].sort((a, b) => matchKda(b) - matchKda(a))[0], [matches]);
  const topChamp = bestChampions(data.champions, 8, 1)[0];
  const first = matches[matches.length - 1];
  const region = REGIONS.find((r) => r.value === player.region)?.label ?? player.region;

  const seasons: Array<{ label: string; rank: Rank; current?: boolean }> = [
    ...player.seasonHistory.map((h) => ({ label: `Temporada ${h.season}`, rank: h.rank })),
    { label: 'Temporada 2026 · atual', rank: player.rank, current: true },
  ];
  const maxAbs = Math.max(...seasons.map((x) => rankToAbsolute(x.rank)), rankToAbsolute(data.peakRank));
  const minAbs = Math.min(...seasons.map((x) => rankToAbsolute(x.rank))) - 300;

  return (
    <>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <ProfileAvatar name={player.gameName} uri={profileIconUrl(player.profileIconId)} level={player.level} size={72} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={type.h1} numberOfLines={1}>
              {player.gameName}
              <Text style={{ color: colors.textMuted, fontSize: 16 }}> #{player.tagLine}</Text>
            </Text>
            <Text style={type.bodySm}>
              {region} ({player.region}) · Nível {player.level}
            </Text>
            {data.identity.primary ? (
              <View style={styles.identityTag}>
                <Ionicons name="sparkles" size={11} color={colors.gold} />
                <Text style={styles.identityTagText}>{data.identity.primary.title}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.infoGrid}>
          <Info label="Riot ID" value={`${player.gameName}#${player.tagLine}`} />
          <Info label="Servidor" value={player.region} />
          <Info label="Dados desde" value={first ? dateShort(first.timestamp) : '—'} />
          <Info label="Atualizado em" value={dateShort(data.asOf)} />
        </View>
      </Card>

      <Card>
        <SectionHeader title="Elo atual" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <RankEmblem rank={player.rank} size={58} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[type.h1, { color: TIER_COLOR[player.rank.tier] }]}>{rankLabel(player.rank)}</Text>
            <Meter value={player.rank.lp / 100} color={TIER_COLOR[player.rank.tier]} />
            <Text style={type.bodySm}>
              {player.rank.lp} LP · faltam {100 - player.rank.lp} LP para a próxima divisão
            </Text>
          </View>
        </View>

        <Text style={[type.h3, { marginTop: space.xl, marginBottom: space.md }]}>Histórico de elos</Text>
        <View style={{ gap: space.md }}>
          {seasons.map((x) => (
            <View key={x.label} style={{ gap: 5 }}>
              <View style={styles.rowBetween}>
                <Text style={[type.bodySm, x.current && { color: colors.text }]}>{x.label}</Text>
                <Text style={[type.h3, { color: TIER_COLOR[x.rank.tier] }]}>
                  {rankLabel(x.rank)} <Text style={styles.muted}>{x.rank.lp} LP</Text>
                </Text>
              </View>
              <Meter value={(rankToAbsolute(x.rank) - minAbs) / (maxAbs - minAbs)} color={TIER_COLOR[x.rank.tier]} height={5} />
            </View>
          ))}
        </View>
        <View style={styles.peak}>
          <Ionicons name="trophy" size={14} color={colors.gold} />
          <Text style={type.bodySm}>
            Melhor elo histórico: <Text style={{ color: colors.text }}>{rankLabel(data.peakRank)} · {data.peakRank.lp} LP</Text>
          </Text>
        </View>
      </Card>

      <IdentityCard data={data} />

      <Card>
        <SectionHeader title="Destaques" />
        <View style={{ gap: space.sm }}>
          {mostPlayed ? (
            <Highlight
              left={<ChampionAvatar id={mostPlayed.championId} size={40} />}
              label="Campeão mais jogado"
              value={champion(mostPlayed.championId).name}
              detail={`${mostPlayed.games} partidas · ${pct(mostPlayed.winRate)}`}
              onPress={() => router.push({ pathname: '/campeao/[id]', params: { id: mostPlayed.championId } })}
            />
          ) : null}
          {topChamp && topChamp.championId !== mostPlayed?.championId ? (
            <Highlight
              left={<ChampionAvatar id={topChamp.championId} size={40} />}
              label="Melhor campeão"
              value={champion(topChamp.championId).name}
              detail={`${pct(topChamp.winRate)} em ${topChamp.games} partidas`}
              onPress={() => router.push({ pathname: '/campeao/[id]', params: { id: topChamp.championId } })}
            />
          ) : null}
          {bestPosition ? (
            <Highlight icon="navigate" label="Melhor posição" value={POSITION_LABEL[bestPosition.position]} detail={`${pct(bestPosition.winRate)} em ${bestPosition.games} partidas · KDA ${dec(bestPosition.kda, 2)}`} />
          ) : null}
          <Highlight icon="flame" label="Maior sequência de vitórias" value={`${data.streaks.longestWin} vitórias`} detail={`Maior sequência negativa: ${data.streaks.longestLoss} derrotas`} />
          {bestKdaMatch ? (
            <Highlight
              left={<ChampionAvatar id={bestKdaMatch.championId} size={40} />}
              label="Melhor KDA em uma partida"
              value={`${dec(matchKda(bestKdaMatch), 1)} KDA`}
              detail={`${bestKdaMatch.kills}/${bestKdaMatch.deaths}/${bestKdaMatch.assists} com ${champion(bestKdaMatch.championId).name} · ${dateShort(bestKdaMatch.timestamp)}`}
              onPress={() => router.push({ pathname: '/partida/[id]', params: { id: bestKdaMatch.id } })}
            />
          ) : null}
        </View>
      </Card>

      <Card>
        <SectionHeader title="Estatísticas gerais da carreira" subtitle="Somatório de todas as partidas registradas" />
        <TileGrid columns={3}>
          <StatTile label="Partidas" value={`${s.games}`} hint={`${s.wins}V ${s.losses}D`} />
          <StatTile label="Vitórias" value={pct(s.winRate)} hint="taxa geral" />
          <StatTile label="KDA" value={dec(s.kda, 2)} hint="médio" />
          <StatTile label="Abates" value={int(s.avgKills * s.games)} hint={`${dec(s.avgKills)} por jogo`} />
          <StatTile label="Mortes" value={int(s.avgDeaths * s.games)} hint={`${dec(s.avgDeaths)} por jogo`} />
          <StatTile label="Assist." value={int(s.avgAssists * s.games)} hint={`${dec(s.avgAssists)} por jogo`} />
          <StatTile label="Dano total" value={compact(s.avgDamage * s.games)} hint={`${int(s.damagePerMin)}/min`} />
          <StatTile label="CS/min" value={dec(s.csPerMin)} hint="farm médio" />
          <StatTile label="Tempo" value={`${Math.round((s.avgDurationSec * s.games) / 3600)} h`} hint="em partida" />
        </TileGrid>
      </Card>

      <Pressable onPress={() => router.push('/insights')} accessibilityRole="button" style={({ pressed }) => [styles.cta, pressed && { opacity: 0.8 }]}>
        <Ionicons name="bulb" size={18} color={colors.gold} />
        <View style={{ flex: 1 }}>
          <Text style={type.h3}>Ver insights</Text>
          <Text style={type.bodySm}>{data.insights.insights.length} observações calculadas sobre suas partidas</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>

      <Text style={[type.bodySm, { textAlign: 'center' }]}>
        Protótipo com dados demonstrativos. LOL Insight não é endossado pela Riot Games.
      </Text>
    </>
  );
}

function IdentityCard({ data }: { data: Derived }) {
  const id = data.identity;
  const [selected, setSelected] = useState<TraitKey | undefined>(id.primary?.key);
  if (!id.enough || !id.primary) {
    return (
      <Card>
        <SectionHeader title="Identidade competitiva" />
        <EmptyState icon="finger-print-outline" title="Amostra insuficiente" message={`São necessárias 20 partidas para classificar o estilo de jogo (há ${id.sample}).`} />
      </Card>
    );
  }
  const trait = id.traits.find((t) => t.key === selected) ?? id.primary;
  const ranked = [...id.traits].sort((a, b) => b.score - a.score);
  return (
    <Card>
      <SectionHeader title="Identidade competitiva" subtitle={`Classificação calculada sobre ${id.sample} partidas`} />
      <View style={styles.identity}>
        <Text style={type.label}>Perfil dominante</Text>
        <Text style={[type.h1, { color: colors.gold }]}>{id.primary.title}</Text>
        {id.secondary ? <Text style={type.bodySm}>Também se destaca como: {id.secondary.title.toLowerCase()}</Text> : null}
      </View>

      <RadarChart axes={id.traits.map((t) => ({ key: t.key, label: t.axis, value: t.score }))} selected={trait.key} onSelect={(k) => setSelected(k as TraitKey)} size={300} />

      <View style={styles.evidence}>
        <View style={styles.rowBetween}>
          <Text style={type.h3}>{trait.axis}</Text>
          <Text style={[type.h3, { color: colors.gold }]}>{trait.score} / 100</Text>
        </View>
        <Text style={type.bodySm}>{trait.evidence}</Text>
      </View>

      <View style={{ gap: 10, marginTop: space.lg }}>
        {ranked.map((t) => (
          <Pressable key={t.key} onPress={() => setSelected(t.key)} accessibilityRole="button" accessibilityLabel={`${t.title}: ${t.score} de 100`} style={{ gap: 5 }}>
            <View style={styles.rowBetween}>
              <Text style={[type.bodySm, t.key === trait.key && { color: colors.text }]}>{t.title}</Text>
              <Text style={[styles.score, t.key === trait.key && { color: colors.text }]}>{t.score}</Text>
            </View>
            <Meter value={t.score / 100} color={t.key === id.primary?.key ? colors.gold : colors.accent} height={5} />
          </Pressable>
        ))}
      </View>
      <Text style={[type.bodySm, { marginTop: space.lg }]}>
        Como calculamos: cada partida é comparada a uma referência da posição jogada. 50 equivale à referência; a linha dourada do radar marca esse nível.
      </Text>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={type.label}>{label}</Text>
      <Text style={[type.h3, { marginTop: 3 }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

interface HighlightProps {
  left?: React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  detail: string;
  onPress?: () => void;
}

function Highlight({ left, icon, label, value, detail, onPress }: HighlightProps) {
  const body = (
    <>
      {left ?? (
        <View style={styles.hlIcon}>
          <Ionicons name={icon ?? 'star'} size={18} color={colors.accentSoft} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={type.label}>{label}</Text>
        <Text style={[type.h3, { fontSize: 15, marginTop: 2 }]}>{value}</Text>
        <Text style={type.bodySm} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={14} color={colors.textMuted} /> : null}
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.hl, pressed && { backgroundColor: colors.surfaceHigh }]}>
      {body}
    </Pressable>
  ) : (
    <View style={styles.hl}>{body}</View>
  );
}

const styles = StyleSheet.create({
  identityTag: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 9, height: 24, borderRadius: 12, backgroundColor: colors.goldDim },
  identityTagText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.gold },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.borderSoft, rowGap: space.md },
  info: { width: '50%' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  muted: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted },
  peak: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  identity: { alignItems: 'center', gap: 4, marginBottom: space.sm },
  evidence: { gap: 4, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderSoft },
  score: { fontFamily: fonts.display, fontSize: 12.5, color: colors.textSecondary },
  hl: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderSoft },
  hlIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentDim },
  cta: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(201,164,92,0.4)' },
});
