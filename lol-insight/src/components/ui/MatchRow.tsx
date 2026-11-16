import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { champion, POSITION_LABEL } from '@/data/champions';
import { matchCsPerMin, matchKda } from '@/stats/aggregate';
import { dec, duration, QUEUE_SHORT, relativeDay } from '@/stats/format';
import { rankShort } from '@/stats/rank';
import { colors, fonts, radius, space } from '@/theme';
import type { Match } from '@/types';

import { ChampionAvatar } from './Avatars';
import { PressableScale } from './Motion';

interface MatchRowProps {
  match: Match;
  asOf: number;
  onPress: () => void;
  /** Exibe modo de jogo e elo no momento da partida. */
  detailed?: boolean;
}

export const MatchRow = React.memo(function MatchRow({ match: m, asOf, onPress, detailed }: MatchRowProps) {
  const c = champion(m.championId);
  const tone = m.win ? colors.win : colors.loss;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${m.win ? 'Vitória' : 'Derrota'} com ${c.name}, ${m.kills}/${m.deaths}/${m.assists}`}
      style={styles.row}>
      <View style={[styles.stripe, { backgroundColor: tone }]} />
      <ChampionAvatar id={m.championId} size={44} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.line}>
          <Text style={styles.name} numberOfLines={1}>
            {c.name}
          </Text>
          <Text style={[styles.result, { color: m.win ? colors.accentSoft : colors.loss }]}>{m.win ? 'Vitória' : 'Derrota'}</Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {POSITION_LABEL[m.position]} · {duration(m.durationSec)} · {relativeDay(m.timestamp, asOf)}
        </Text>
        {detailed ? (
          <Text style={styles.meta} numberOfLines={1}>
            {QUEUE_SHORT[m.queue]}
            {m.rankAfter ? ` · ${rankShort(m.rankAfter)} ${m.rankAfter.lp} LP` : ''}
            {m.lpDelta ? ` (${m.lpDelta > 0 ? '+' : '−'}${Math.abs(m.lpDelta)})` : ''}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <Text style={styles.kda}>
          {m.kills}
          <Text style={styles.sep}> / </Text>
          <Text style={{ color: colors.loss }}>{m.deaths}</Text>
          <Text style={styles.sep}> / </Text>
          {m.assists}
        </Text>
        <Text style={styles.meta}>
          {dec(matchKda(m), 1)} KDA · {m.cs} CS
        </Text>
        {detailed ? <Text style={styles.meta}>{dec(matchCsPerMin(m), 1)} CS/min</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 11,
    paddingRight: space.md,
    paddingLeft: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text, flexShrink: 1 },
  result: { fontFamily: fonts.bodyBold, fontSize: 11 },
  meta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted },
  kda: { fontFamily: fonts.display, fontSize: 15.5, color: colors.text },
  sep: { color: colors.textMuted },
});
