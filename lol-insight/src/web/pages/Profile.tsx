import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RadarChart } from '@/components/charts';
import { AccountCard } from '@/components/auth/AccountCard';
import { ProfileAvatar, RankEmblem } from '@/components/ui';
import { profileIconUrl } from '@/data/champions';
import { useChallenge } from '@/hooks/useChallenge';
import { useCoach } from '@/state/CoachContext';
import { usePlayer, type Derived } from '@/state/PlayerContext';
import { compact, dec, int, pct } from '@/stats/format';
import type { TraitKey } from '@/stats/identity';
import { rankLabel, TIER_COLOR } from '@/stats/rank';
import { colors, fonts, radius } from '@/theme';

import { Button, Cols, DataGate, Kpi, KpiStrip, MiniBar, Page, Panel, Split, T, Tag } from './kit';
import { EvolutionPanel, TopChampions } from './parts';

/** Perfil competitivo: identidade, elo, carreira, campeões e progresso na Academy e no Challenge. */
export function WebProfile() {
  const { settings } = usePlayer();
  return (
    <Page eyebrow="Perfil" title="Perfil competitivo" subtitle={settings.mode === 'demo' ? 'Conta demonstrativa (dados fictícios)' : 'Dados da Riot Games API e do seu progresso no LOL Insight'}>
      {settings.mode === 'riot' ? <AccountCard /> : null}
      <DataGate>{(d) => <Body data={d} />}</DataGate>
    </Page>
  );
}

function Body({ data }: { data: Derived }) {
  const { player, identity, summary: s } = data;
  const [trait, setTrait] = useState<TraitKey | null>(identity.primary?.key ?? null);
  const sel = identity.traits.find((t) => t.key === trait) ?? identity.traits[0];
  const totalHours = Math.round((s.avgDurationSec * s.games) / 3600);
  return (
    <>
      <Panel>
        <View style={styles.hero}>
          <ProfileAvatar name={player.gameName} uri={profileIconUrl(player.profileIconId)} level={player.level} size={84} />
          <View style={{ flex: 1, minWidth: 240, gap: 6 }}>
            <Text style={styles.name}>
              {player.gameName}
              <Text style={styles.tag}> #{player.tagLine}</Text>
            </Text>
            <Text style={styles.meta}>
              {player.region} · Nível {player.level}
            </Text>
            {identity.primary ? <Tag text={identity.primary.title.toUpperCase()} color={colors.gold} /> : null}
          </View>
          <View style={styles.rank}>
            {player.rank ? <RankEmblem rank={player.rank} size={88} /> : null}
            <View style={{ gap: 2 }}>
              <Text style={[styles.rankName, { color: player.rank ? TIER_COLOR[player.rank.tier] : colors.textMuted }]}>{player.rank ? rankLabel(player.rank) : 'Sem elo'}</Text>
              <Text style={styles.meta}>{player.rank ? `${player.rank.lp} LP · Solo/Duo` : 'Solo/Duo'}</Text>
              {player.ranked?.solo ? <Text style={styles.meta}>Temporada: {player.ranked.solo.wins}V {player.ranked.solo.losses}D</Text> : null}
              {player.ranked?.flex ? <Text style={styles.meta}>Flex: {rankLabel(player.ranked.flex.rank)}</Text> : null}
            </View>
          </View>
        </View>
      </Panel>
      <KpiStrip>
        <Kpi label="Partidas analisadas" value={int(s.games)} hint={`${s.wins}V ${s.losses}D`} />
        <Kpi label="Taxa de vitória" value={pct(s.winRate, 1)} />
        <Kpi label="KDA" value={dec(s.kda, 2)} />
        <Kpi label="Abates" value={int(s.avgKills * s.games)} hint={`${dec(s.avgKills)} por partida`} />
        <Kpi label="Dano total" value={compact(s.avgDamage * s.games)} />
        <Kpi label="Tempo em partida" value={`${totalHours} h`} />
        <Kpi label="Melhor série" value={`${data.streaks.longestWin}V`} />
      </KpiStrip>
      <Split>
        <Panel title="Identidade competitiva" subtitle={identity.enough ? `Calculada sobre ${identity.sample} partidas, na referência do seu elo` : `São necessárias 20 partidas (há ${identity.sample})`} info="Cada traço vai de 0 a 100; 50 é a referência da posição no seu elo.">
          {identity.enough ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
              <View style={{ flexGrow: 1, flexBasis: 300, alignItems: 'center' }}>
                <RadarChart axes={identity.traits.map((t) => ({ key: t.key, label: t.axis, value: t.score }))} selected={sel?.key} onSelect={(k) => setTrait(k as TraitKey)} size={340} />
              </View>
              <View style={{ flexGrow: 1, flexBasis: 260, gap: 6 }}>
                {identity.traits.map((t) => (
                  <View key={t.key} style={[styles.trait, t.key === sel?.key && { backgroundColor: colors.surfaceAlt }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.traitName}>{t.axis}</Text>
                      <T strong>{String(t.score)}</T>
                    </View>
                    <MiniBar value={t.score} max={100} color={t.score >= 60 ? colors.good : t.score <= 40 ? colors.loss : colors.accent} />
                    {t.key === sel?.key ? <Text style={styles.evidence}>{t.evidence}</Text> : null}
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text style={styles.meta}>Jogue mais partidas para calcular os traços.</Text>
          )}
        </Panel>
        <View style={{ gap: 20 }}>
          <Panel title="Campeões principais" padded={false}>
            <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
              <TopChampions matches={data.matches} limit={5} />
            </View>
          </Panel>
          <Panel title="Histórico de elo">
            {player.seasonHistory.length ? (
              player.seasonHistory.map((h) => (
                <View key={h.season} style={styles.season}>
                  <Text style={styles.meta}>Temporada {h.season}</Text>
                  <Text style={[styles.traitName, { color: TIER_COLOR[h.rank.tier] }]}>{rankLabel(h.rank)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.meta}>A Riot não informa o elo de temporadas anteriores. O LOL Insight registra o elo a partir da primeira consulta.</Text>
            )}
            {data.source === 'demo' && player.seasonHistory.length ? <Text style={styles.note}>Histórico de temporadas fictício (demonstração).</Text> : null}
          </Panel>
        </View>
      </Split>
      <EvolutionPanel data={data} days={0} />
      <Progress />
    </>
  );
}

function Progress() {
  const router = useRouter();
  const { report } = useCoach();
  const ch = useChallenge();
  const s = ch.state;
  return (
    <Cols lg={2} md={1}>
      <Panel title="Progresso na LOI Academy" right={<Button kind="ghost" label="Abrir" onPress={() => router.navigate('/academy')} />}>
        {report ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.big}>
              Nível {report.academy.level.index} <Text style={styles.meta}>· {report.academy.level.name}</Text>
            </Text>
            <MiniBar value={report.academy.level.progress} max={1} color={colors.gold} />
            <Text style={styles.meta}>
              {report.academy.lessonsCompleted} de {report.academy.lessonsTotal} aulas · sequência de {report.academy.streakDays} {report.academy.streakDays === 1 ? "dia" : "dias"}
            </Text>
          </View>
        ) : (
          <Text style={styles.meta}>Carregue um perfil para ver o progresso.</Text>
        )}
      </Panel>
      <Panel title="Progresso no LOL Challenge" right={<Button kind="ghost" label="Abrir" onPress={() => router.navigate('/desafios')} />}>
        {s ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.big}>
              Nível {s.level.level} <Text style={styles.meta}>· {s.level.name} · {s.xp} XP</Text>
            </Text>
            <MiniBar value={s.level.progress} max={1} color={colors.gold} />
            <Text style={styles.meta}>
              Sequência de {s.streak} {s.streak === 1 ? "dia" : "dias"} · {s.achievements.filter((a) => a.unlocked).length} conquistas
            </Text>
            <View style={styles.achRow}>
              {s.achievements.filter((a) => a.unlocked).map((a) => (
                <View key={a.id} style={styles.ach}>
                  <Ionicons name="trophy" size={13} color={colors.gold} />
                  <Text style={styles.achText}>{a.title}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.meta}>{ch.available ? 'Carregando…' : 'Entre na sua conta para acompanhar o Challenge.'}</Text>
        )}
      </Panel>
    </Cols>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 24 },
  name: { fontFamily: fonts.title, fontSize: 34, color: colors.text },
  tag: { fontFamily: fonts.display, fontSize: 24, color: colors.textMuted },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  rank: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rankName: { fontFamily: fonts.title, fontSize: 26 },
  trait: { padding: 8, borderRadius: radius.md, gap: 5 },
  traitName: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text },
  evidence: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary },
  season: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  note: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 8 },
  big: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.text },
  achRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ach: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 24, borderRadius: radius.pill, backgroundColor: colors.goldDim },
  achText: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: colors.gold },
});
