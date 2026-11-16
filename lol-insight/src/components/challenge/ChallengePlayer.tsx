import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORY_LABEL, DIFFICULTY_LABEL, type Challenge, type ChallengeAttempt } from '@/challenge';
import { lessonById } from '@/coach/lessons';
import { haptic } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';

const DIFF_COLOR = { facil: colors.good, medio: colors.gold, dificil: colors.loss } as const;

/**
 * Um desafio: situação, pergunta, alternativas e, depois da resposta, a
 * correção com explicação e XP. Mesmo componente no Android e na web.
 */
export function ChallengePlayer({
  challenge: c,
  daily,
  previous,
  onSubmit,
}: {
  challenge: Challenge;
  daily?: boolean;
  /** Resposta já registrada para este desafio (mostra a correção direto). */
  previous?: ChallengeAttempt | null;
  onSubmit: (answer: number) => Promise<{ attempt: ChallengeAttempt; alreadyAnswered: boolean } | null>;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<number | null>(null);
  const [result, setResult] = useState<{ attempt: ChallengeAttempt; alreadyAnswered: boolean } | null>(previous ? { attempt: previous, alreadyAnswered: true } : null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setChoice(null);
    setResult(previous ? { attempt: previous, alreadyAnswered: true } : null);
  }, [c.id, previous]);

  const confirm = async () => {
    if (choice === null) return;
    setBusy(true);
    const r = await onSubmit(choice);
    setBusy(false);
    if (r) {
      setResult(r);
      if (r.attempt.correct) haptic.success();
    }
  };

  const answered = result?.attempt;
  const lesson = c.lessonId ? lessonById(c.lessonId) : undefined;
  return (
    <View style={{ gap: space.md }}>
      <View style={styles.tags}>
        {daily ? <Tag text="DESAFIO DIÁRIO" color={colors.gold} /> : null}
        <Tag text={CATEGORY_LABEL[c.category].toUpperCase()} color={colors.accentSoft} />
        <Tag text={DIFFICULTY_LABEL[c.difficulty].toUpperCase()} color={DIFF_COLOR[c.difficulty]} />
      </View>
      <Text style={styles.title}>{c.title}</Text>
      <View style={styles.context}>
        <Ionicons name="map-outline" size={16} color={colors.textMuted} style={{ marginTop: 2 }} />
        <Text style={styles.contextText}>{c.context}</Text>
      </View>
      <Text style={styles.question}>{c.question}</Text>
      <View style={{ gap: 8 }} accessibilityRole="radiogroup">
        {c.options.map((o, i) => {
          const picked = answered ? answered.answer === i : choice === i;
          const right = answered && i === c.answer;
          const wrong = answered && picked && !answered.correct;
          return (
            <Pressable
              key={i}
              disabled={!!answered || busy}
              onPress={() => {
                haptic.select();
                setChoice(i);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: picked, disabled: !!answered }}
              accessibilityLabel={o}
              style={({ pressed }) => [styles.option, picked && !answered && styles.optionPicked, right && styles.optionRight, wrong && styles.optionWrong, pressed && { opacity: 0.85 }]}>
              <View style={[styles.letter, picked && !answered && { backgroundColor: colors.accent }, right && { backgroundColor: colors.good }, wrong && { backgroundColor: colors.loss }]}>
                <Text style={styles.letterText}>{right ? '✓' : wrong ? '✕' : String.fromCharCode(65 + i)}</Text>
              </View>
              <Text style={[styles.optionText, (right || (picked && !answered)) && { color: colors.text }]}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
      {!answered ? (
        <Pressable onPress={confirm} disabled={choice === null || busy} accessibilityRole="button" accessibilityLabel="Confirmar resposta" style={[styles.confirm, (choice === null || busy) && { opacity: 0.45 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Confirmar resposta</Text>}
        </Pressable>
      ) : (
        <View style={[styles.feedback, { borderColor: answered.correct ? 'rgba(47,179,128,0.45)' : 'rgba(229,96,106,0.45)' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name={answered.correct ? 'checkmark-circle' : 'close-circle'} size={20} color={answered.correct ? colors.good : colors.loss} />
            <Text style={[styles.feedbackTitle, { color: answered.correct ? colors.good : colors.loss }]}>{answered.correct ? 'Decisão certa' : 'Não foi a melhor decisão'}</Text>
            <Text style={styles.xp}>{answered.xp ? `+${answered.xp} XP` : '0 XP'}</Text>
          </View>
          <Text style={styles.explanation}>{c.explanation}</Text>
          {result?.alreadyAnswered ? <Text style={styles.note}>Você já tinha respondido este desafio: vale a primeira resposta.</Text> : null}
          {lesson ? (
            <Pressable onPress={() => router.push({ pathname: '/academy/aula/[id]', params: { id: lesson.id } })} accessibilityRole="link" accessibilityLabel={`Aula: ${lesson.title}`} style={styles.lesson}>
              <Ionicons name="school-outline" size={14} color={colors.accentSoft} />
              <Text style={styles.lessonText}>Aula relacionada: {lesson.title}</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: `${color}1f` }]}>
      <Text style={[styles.tagText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderRadius: radius.pill, paddingHorizontal: 8, height: 20, justifyContent: 'center' },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.6 },
  title: { fontFamily: fonts.title, fontSize: 22, color: colors.text },
  context: { flexDirection: 'row', gap: 10, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md },
  contextText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  question: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: 'transparent' },
  optionPicked: { borderColor: 'rgba(92,155,255,0.6)', backgroundColor: colors.accentDim },
  optionRight: { borderColor: 'rgba(47,179,128,0.6)', backgroundColor: 'rgba(47,179,128,0.12)' },
  optionWrong: { borderColor: 'rgba(229,96,106,0.6)', backgroundColor: colors.lossDim },
  letter: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.text },
  optionText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  confirm: { height: 46, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  confirmText: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#fff' },
  feedback: { gap: 8, padding: space.md, borderRadius: radius.md, borderWidth: 1, backgroundColor: colors.surfaceAlt },
  feedbackTitle: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15 },
  xp: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.gold },
  explanation: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  lesson: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  lessonText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.accentSoft },
});
