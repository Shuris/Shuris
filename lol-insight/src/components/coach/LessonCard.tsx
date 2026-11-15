import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORIES, LEVEL_LABEL, type Lesson, type LessonProgress } from '@/coach';
import { colors, fonts, radius, space, type } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Cor de destaque de cada categoria (usada apenas em ícones e filetes, nunca em texto corrido). */
export const CATEGORY_TINT: Record<Lesson['category'], string> = {
  fundamentos: '#5C9BFF',
  rotas: '#3FB98A',
  combate: '#E0705F',
  macro: '#C9A45C',
  mentalidade: '#9B8CF0',
};

interface LessonCardProps {
  lesson: Lesson;
  progress?: LessonProgress;
  /** Motivo da recomendação (vem do diagnóstico). */
  reason?: string;
  onPress: () => void;
  compact?: boolean;
}

export function LessonCard({ lesson, progress, reason, onPress, compact }: LessonCardProps) {
  const tint = CATEGORY_TINT[lesson.category];
  const done = !!progress?.completedAt;
  const tried = !done && (progress?.attempts.length ?? 0) > 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Aula: ${lesson.title}. ${LEVEL_LABEL[lesson.level]}, ${lesson.minutes} minutos${done ? ', concluída' : ''}`}
      style={({ pressed }) => [styles.card, compact && styles.compact, pressed && { backgroundColor: colors.surfaceHigh }]}>
      <View style={[styles.stripe, { backgroundColor: tint }]} />
      <View style={[styles.icon, { backgroundColor: `${tint}22` }]}>
        <Ionicons name={CATEGORIES[lesson.category].icon as IconName} size={18} color={tint} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={type.label} numberOfLines={1}>
          {CATEGORIES[lesson.category].name}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {lesson.title}
        </Text>
        <Text style={styles.meta}>
          {LEVEL_LABEL[lesson.level]} · {lesson.minutes} min · {lesson.quiz.length} perguntas
        </Text>
        {reason ? (
          <View style={styles.reason}>
            <Ionicons name="pulse" size={12} color={colors.gold} style={{ marginTop: 2 }} />
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        ) : null}
      </View>
      {done ? (
        <View style={styles.done}>
          <Ionicons name="checkmark-circle" size={18} color={colors.good} />
          <Text style={styles.score}>{Math.round((progress?.bestScore ?? 0) * 100)}%</Text>
        </View>
      ) : tried ? (
        <Ionicons name="refresh-circle-outline" size={18} color={colors.warning} />
      ) : (
        <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingRight: space.md,
    paddingLeft: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  compact: { width: 264 },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 14.5, lineHeight: 19, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted },
  reason: { flexDirection: 'row', gap: 6, marginTop: 4 },
  reasonText: { flex: 1, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, color: colors.textSecondary },
  done: { alignItems: 'center', gap: 2 },
  score: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.good },
});
