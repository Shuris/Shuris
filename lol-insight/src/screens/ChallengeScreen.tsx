import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORY_LABEL, DIFFICULTY_LABEL, type Challenge } from '@/challenge';
import { AuthPrompt } from '@/components/auth/AccountCard';
import { ChallengePlayer } from '@/components/challenge/ChallengePlayer';
import { Card, Screen, ScreenSkeleton, SectionHeader, StatTile, TileGrid } from '@/components/ui';
import { useChallenge } from '@/hooks/useChallenge';
import { colors, fonts, radius, space, type } from '@/theme';

/** LOL Challenge no Android: o essencial (desafio do dia, sequência e próximos desafios). */
export function ChallengeScreen() {
  const ch = useChallenge();
  const s = ch.state;
  const [extra, setExtra] = useState<Challenge | null>(null);
  if (!ch.available)
    return (
      <Screen title="LOL Challenge" back>
        <AuthPrompt />
      </Screen>
    );
  if (!s)
    return (
      <Screen title="LOL Challenge" back>
        {ch.error ? <Text style={type.bodySm}>{ch.error}</Text> : <ScreenSkeleton cards={2} hero={false} />}
      </Screen>
    );
  const current = extra ?? s.daily;
  const previous = extra ? (s.attempts.find((a) => !a.daily && a.challengeId === extra.id) ?? null) : s.dailyAttempt;
  return (
    <Screen title="LOL Challenge" subtitle={ch.service?.kind === 'demo' ? 'Demonstração: histórico anterior fictício' : 'Desafios de decisão'} back>
      <TileGrid columns={3}>
        <StatTile label="Nível" value={String(s.level.level)} hint={s.level.name} />
        <StatTile label="XP" value={String(s.xp)} hint={`${s.level.to - s.xp} para subir`} />
        <StatTile label="Sequência" value={`${s.streak}d`} hint={`recorde ${s.bestStreak}d`} />
      </TileGrid>
      <Card>
        <ChallengePlayer challenge={current} daily={!extra} previous={previous} onSubmit={(a) => ch.submit(current.id, a, !extra)} />
        {extra ? (
          <Pressable onPress={() => setExtra(null)} style={{ marginTop: space.md }} accessibilityRole="button">
            <Text style={styles.link}>Voltar ao desafio do dia</Text>
          </Pressable>
        ) : null}
      </Card>
      <Card>
        <SectionHeader title="Próximos desafios" subtitle="A categoria em que você mais erra aparece primeiro" />
        <View style={{ gap: space.sm }}>
          {s.next.slice(0, 5).map((c) => (
            <Pressable key={c.id} onPress={() => setExtra(c)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={`Desafio ${c.title}`}>
              <Text style={type.h3}>{c.title}</Text>
              <Text style={type.bodySm}>
                {CATEGORY_LABEL[c.category]} · {DIFFICULTY_LABEL[c.difficulty]}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[type.bodySm, { marginTop: space.md }]}>Calendário, conquistas, ranking e estatísticas completas estão na versão web.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, gap: 2 },
  link: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.accentSoft },
});
