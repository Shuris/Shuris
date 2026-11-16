import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ChampionAvatar, RankEmblem } from '@/components/ui';
import { champion, POSITION_LABEL } from '@/data/champions';
import { pct } from '@/stats/format';
import { rankLabel, TIER_COLOR } from '@/stats/rank';
import { colors, fonts } from '@/theme';
import type { Position, Rank } from '@/types';

export function ChampCell({ id, sub, size = 30 }: { id: string; sub?: string; size?: number }) {
  return (
    <View style={styles.row}>
      <ChampionAvatar id={id} size={size} />
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {champion(id).name}
        </Text>
        {sub ? (
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function ResultPill({ win }: { win: boolean }) {
  return (
    <View style={[styles.pill, { backgroundColor: win ? colors.winDim : colors.lossDim }]}>
      <Text style={[styles.pillText, { color: win ? colors.accentSoft : colors.loss }]}>{win ? 'Vitória' : 'Derrota'}</Text>
    </View>
  );
}

/** Taxa de vitória com cor: azul acima de 50%, vermelho abaixo; esmaecida se a amostra é pequena. */
export function WinRate({ value, games, min = 5 }: { value: number; games: number; min?: number }) {
  const small = games < min;
  return (
    <Text style={[styles.wr, { color: small ? colors.textMuted : value >= 0.5 ? colors.accentSoft : colors.loss }]}>
      {pct(value)}
      {small ? <Text style={styles.small}> · amostra pequena</Text> : null}
    </Text>
  );
}

/** Barra horizontal fina para comparar valores dentro de uma tabela. */
export function MiniBar({ value, max, color = colors.accent }: { value: number; max: number; color?: string }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.max(2, Math.min(100, (value / Math.max(max, 1e-9)) * 100))}%`, backgroundColor: color }]} />
    </View>
  );
}

export function RankInline({ rank }: { rank: Rank | null }) {
  if (!rank) return <Text style={styles.sub}>Sem elo</Text>;
  return (
    <View style={styles.row}>
      <RankEmblem rank={rank} size={22} />
      <Text style={[styles.name, { color: TIER_COLOR[rank.tier] }]}>{rankLabel(rank)}</Text>
    </View>
  );
}

export const positionLabel = (p: Position) => POSITION_LABEL[p];

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted },
  pill: { borderRadius: 6, paddingHorizontal: 8, height: 22, justifyContent: 'center' },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  wr: { fontFamily: fonts.display, fontSize: 15 },
  small: { fontFamily: fonts.body, fontSize: 11 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceHigh, overflow: 'hidden', width: '100%' },
  fill: { height: 6, borderRadius: 3 },
});
