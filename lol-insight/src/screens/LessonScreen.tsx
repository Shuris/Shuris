import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORIES, lessonById, LESSONS, LEVEL_LABEL, PASS_SCORE, SKILLS, type Lesson, type QuizResult } from '@/coach';
import { CATEGORY_TINT } from '@/components/coach/LessonCard';
import { Card, EmptyState, Screen } from '@/components/ui';
import { useCoach } from '@/state/CoachContext';
import { dateShort } from '@/stats/format';
import { colors, fonts, radius, space, type } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const lesson = lessonById(id);

  if (!lesson) {
    return (
      <Screen title="Aula" back>
        <Card>
          <EmptyState icon="alert-circle-outline" title="Aula não encontrada" message="Esta aula não existe no catálogo." actionLabel="Ver aulas" onAction={() => router.replace('/academy/aulas')} />
        </Card>
      </Screen>
    );
  }
  return (
    <Screen title={lesson.title} subtitle={`${CATEGORIES[lesson.category].name} · ${LEVEL_LABEL[lesson.level]} · ${lesson.minutes} min`} back>
      <Body key={lesson.id} lesson={lesson} />
    </Screen>
  );
}

function Body({ lesson }: { lesson: Lesson }) {
  const tint = CATEGORY_TINT[lesson.category];
  const { report } = useCoach();
  const router = useRouter();
  const progress = report?.progress[lesson.id];
  const next = LESSONS[LESSONS.findIndex((l) => l.id === lesson.id) + 1];

  return (
    <>
      <Card style={{ borderColor: `${tint}66` }}>
        <View style={styles.metaRow}>
          <View style={[styles.catIcon, { backgroundColor: `${tint}22` }]}>
            <Ionicons name={CATEGORIES[lesson.category].icon as IconName} size={18} color={tint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.label}>Objetivo da aula</Text>
            <Text style={styles.objective}>{lesson.objective}</Text>
          </View>
        </View>
        <View style={styles.tags}>
          {lesson.skills.map((s) => (
            <View key={s} style={styles.tag}>
              <Text style={styles.tagText}>{SKILLS[s].name}</Text>
            </View>
          ))}
        </View>
        {progress?.completedAt ? (
          <View style={styles.doneRow}>
            <Ionicons name="checkmark-circle" size={15} color={colors.good} />
            <Text style={type.bodySm}>
              Concluída em {dateShort(progress.completedAt)} · melhor aproveitamento: {Math.round(progress.bestScore * 100)}% · {progress.attempts.length}{' '}
              {progress.attempts.length === 1 ? 'tentativa' : 'tentativas'}
            </Text>
          </View>
        ) : null}
      </Card>

      <Section icon="book-outline" title="Explicação">
        {lesson.theory.map((t) => (
          <View key={t.title} style={{ gap: 4 }}>
            <Text style={styles.subheading}>{t.title}</Text>
            <Text style={styles.paragraph}>{t.text}</Text>
          </View>
        ))}
      </Section>

      <Section icon="eye-outline" title="Exemplos práticos">
        {lesson.examples.map((e, i) => (
          <View key={i} style={styles.example}>
            <Text style={styles.paragraph}>{e}</Text>
          </View>
        ))}
      </Section>

      <Section icon="warning-outline" title="Erros comuns" tone={colors.loss}>
        <Bullets items={lesson.mistakes} icon="close-circle-outline" color={colors.loss} />
      </Section>

      <Section icon="game-controller-outline" title="Como aplicar nas partidas" tone={colors.good}>
        <Bullets items={lesson.apply} icon="checkmark-circle-outline" color={colors.good} />
      </Section>

      <Section icon="barbell-outline" title={`Exercício: ${lesson.exercise.title}`} tone={colors.gold}>
        {lesson.exercise.steps.map((s, i) => (
          <View key={i} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{i + 1}</Text>
            </View>
            <Text style={[styles.paragraph, { flex: 1 }]}>{s}</Text>
          </View>
        ))}
        <View style={styles.success}>
          <Ionicons name="flag-outline" size={14} color={colors.gold} style={{ marginTop: 2 }} />
          <Text style={[type.bodySm, { flex: 1, color: colors.text }]}>Critério de sucesso: {lesson.exercise.success}</Text>
        </View>
      </Section>

      <Quiz lesson={lesson} />

      {next ? (
        <Pressable onPress={() => router.replace({ pathname: '/academy/aula/[id]', params: { id: next.id } })} accessibilityRole="button" style={({ pressed }) => [styles.next, pressed && { opacity: 0.85 }]}>
          <View style={{ flex: 1 }}>
            <Text style={type.label}>Próxima aula</Text>
            <Text style={type.h3}>{next.title}</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={colors.accentSoft} />
        </Pressable>
      ) : null}
    </>
  );
}

function Section({ icon, title, tone = colors.accentSoft, children }: { icon: IconName; title: string; tone?: string; children: React.ReactNode }) {
  return (
    <Card>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={16} color={tone} />
        <Text style={[type.h2, { flex: 1 }]}>{title}</Text>
      </View>
      <View style={{ gap: space.md }}>{children}</View>
    </Card>
  );
}

function Bullets({ items, icon, color }: { items: string[]; icon: IconName; color: string }) {
  return (
    <>
      {items.map((text, i) => (
        <View key={i} style={styles.step}>
          <Ionicons name={icon} size={16} color={color} style={{ marginTop: 2 }} />
          <Text style={[styles.paragraph, { flex: 1 }]}>{text}</Text>
        </View>
      ))}
    </>
  );
}

/** Teste de conhecimento: registra acertos, erros e o tempo gasto desde a abertura da aula. */
function Quiz({ lesson }: { lesson: Lesson }) {
  const { submitAttempt, error } = useCoach();
  const [answers, setAnswers] = useState<Array<number | null>>(() => lesson.quiz.map(() => null));
  const [result, setResult] = useState<QuizResult | null>(null);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const startedAt = useRef(Date.now());
  useEffect(() => {
    startedAt.current = Date.now();
  }, [lesson.id]);

  const ready = answers.every((a) => a !== null);
  const submit = async () => {
    if (!ready || sending) return;
    setSending(true);
    setFailed(false);
    const r = await submitAttempt(lesson.id, answers as number[], (Date.now() - startedAt.current) / 1000);
    setSending(false);
    if (r) setResult(r);
    else setFailed(true);
  };
  const retry = () => {
    setAnswers(lesson.quiz.map(() => null));
    setResult(null);
    startedAt.current = Date.now();
  };

  return (
    <Card style={{ borderColor: 'rgba(92,155,255,0.4)' }}>
      <View style={styles.sectionHead}>
        <Ionicons name="help-circle-outline" size={16} color={colors.accentSoft} />
        <Text style={[type.h2, { flex: 1 }]}>Teste de conhecimento</Text>
      </View>
      <Text style={[type.bodySm, { marginBottom: space.md }]}>
        {lesson.quiz.length} perguntas. A aula é concluída com {Math.round(PASS_SCORE * 100)}% de acerto.
      </Text>

      <View style={{ gap: space.lg }}>
        {lesson.quiz.map((q, qi) => (
          <View key={qi} style={{ gap: 8 }}>
            <Text style={styles.question}>
              {qi + 1}. {q.question}
            </Text>
            {q.options.map((opt, oi) => {
              const chosen = answers[qi] === oi;
              const graded = result !== null;
              const correct = graded && oi === q.correct;
              const wrong = graded && chosen && oi !== q.correct;
              return (
                <Pressable
                  key={oi}
                  disabled={graded}
                  onPress={() => setAnswers((prev) => prev.map((v, i) => (i === qi ? oi : v)))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: chosen, disabled: graded }}
                  accessibilityLabel={opt}
                  style={({ pressed }) => [
                    styles.option,
                    chosen && !graded && styles.optionChosen,
                    correct && styles.optionCorrect,
                    wrong && styles.optionWrong,
                    pressed && { opacity: 0.8 },
                  ]}>
                  <Ionicons
                    name={correct ? 'checkmark-circle' : wrong ? 'close-circle' : chosen ? 'radio-button-on' : 'radio-button-off'}
                    size={17}
                    color={correct ? colors.good : wrong ? colors.loss : chosen ? colors.accentSoft : colors.textMuted}
                  />
                  <Text style={[styles.optionText, (chosen || correct) && { color: colors.text }]}>{opt}</Text>
                </Pressable>
              );
            })}
            {result ? (
              <View style={styles.explanation}>
                <Text style={[type.bodySm, { color: colors.text }]}>
                  {answers[qi] === q.correct ? 'Correto. ' : 'Resposta certa destacada. '}
                  {q.explanation}
                </Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>

      {result ? (
        <View style={[styles.result, { borderColor: result.passed ? colors.good : colors.warning }]} accessibilityLiveRegion="polite">
          <Ionicons name={result.passed ? 'trophy' : 'refresh'} size={20} color={result.passed ? colors.good : colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={type.h3}>
              {result.correct} de {result.total} acertos · {Math.round(result.score * 100)}%
            </Text>
            <Text style={type.bodySm}>
              {result.passed
                ? 'Aula concluída. O conhecimento teórico desta habilidade subiu; a nota prática só muda com as próximas partidas.'
                : 'Ainda não foi desta vez. Releia a explicação e tente de novo.'}
            </Text>
          </View>
          <Pressable onPress={retry} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.retry}>Refazer</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={submit} disabled={!ready || sending} accessibilityRole="button" style={({ pressed }) => [styles.submit, (!ready || sending) && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}>
          {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitText}>{ready ? 'Enviar respostas' : 'Responda todas as perguntas'}</Text>}
        </Pressable>
      )}
      {failed ? <Text style={[type.bodySm, { color: colors.loss, marginTop: space.sm }]}>Não foi possível registrar o teste. {error?.message ?? ''} Tente enviar de novo.</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  catIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  objective: { fontFamily: fonts.bodySemi, fontSize: 14.5, lineHeight: 21, color: colors.text, marginTop: 3 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.md },
  tag: { height: 24, paddingHorizontal: 9, borderRadius: 12, justifyContent: 'center', backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  tagText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textSecondary },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: space.md },
  subheading: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  paragraph: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: colors.textSecondary },
  example: { padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderLeftWidth: 3, borderLeftColor: colors.accent },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNumber: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.goldDim, marginTop: 1 },
  stepNumberText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.gold },
  success: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: radius.sm, backgroundColor: colors.goldDim },
  question: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 20, color: colors.text },
  option: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, minHeight: 46 },
  optionChosen: { borderColor: 'rgba(92,155,255,0.7)', backgroundColor: colors.accentDim },
  optionCorrect: { borderColor: colors.good, backgroundColor: 'rgba(47,179,128,0.12)' },
  optionWrong: { borderColor: colors.loss, backgroundColor: colors.lossDim },
  optionText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textSecondary },
  explanation: { padding: 10, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  submit: { marginTop: space.lg, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  submitText: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#fff' },
  result: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg, padding: space.md, borderRadius: radius.md, borderWidth: 1, backgroundColor: colors.surfaceAlt },
  retry: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accentSoft },
  next: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
