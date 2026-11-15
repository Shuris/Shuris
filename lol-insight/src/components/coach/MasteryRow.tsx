import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SKILLS, type SkillMastery } from '@/coach';
import { Meter } from '@/components/ui';
import { colors, fonts, type } from '@/theme';

/**
 * Domínio de uma habilidade em duas barras separadas: o que o jogador sabe
 * (testes) e o que ele faz nas partidas. Uma não substitui a outra.
 */
export function MasteryRow({ mastery }: { mastery: SkillMastery }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.head}>
        <Text style={type.h3}>{SKILLS[mastery.skill].name}</Text>
        <Text style={type.bodySm}>
          {mastery.lessonsDone}/{mastery.lessonsTotal} aulas
        </Text>
      </View>
      <Bar label="Teoria" value={mastery.theory} color={colors.gold} empty="sem aulas" />
      <Bar label="Prática" value={mastery.practice} color={colors.accent} empty="amostra insuficiente" />
      {mastery.practiceChange ? (
        <Text style={[type.bodySm, mastery.practiceChange.improved === true && { color: colors.good }, mastery.practiceChange.improved === false && { color: colors.loss }]}>
          {mastery.practiceChange.text}
        </Text>
      ) : null}
    </View>
  );
}

function Bar({ label, value, color, empty }: { label: string; value: number | null; color: string; empty: string }) {
  return (
    <View style={styles.bar}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={{ flex: 1 }}>
        <Meter value={(value ?? 0) / 100} color={color} height={5} />
      </View>
      <Text style={[styles.barValue, value === null && { color: colors.textMuted, width: 104 }]} numberOfLines={1}>
        {value === null ? empty : value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 48, fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted },
  barValue: { width: 28, textAlign: 'right', fontFamily: fonts.display, fontSize: 12, color: colors.textSecondary },
});
