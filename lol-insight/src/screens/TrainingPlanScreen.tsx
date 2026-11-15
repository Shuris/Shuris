import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SKILLS, type CoachReport, type PlanDay, type PlanEvaluation } from '@/coach';
import { CoachGate } from '@/components/coach/CoachGate';
import { Card, EmptyState, Meter, Screen, SectionHeader } from '@/components/ui';
import { useCoach } from '@/state/CoachContext';
import { dateShort } from '@/stats/format';
import { colors, fonts, radius, space, type } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const KIND: Record<PlanDay['kind'], { icon: IconName; label: string }> = {
  lesson: { icon: 'book-outline', label: 'Aula' },
  exercise: { icon: 'barbell-outline', label: 'Exercício' },
  apply: { icon: 'game-controller-outline', label: 'Partidas' },
  review: { icon: 'stats-chart-outline', label: 'Revisão' },
  evaluate: { icon: 'ribbon-outline', label: 'Avaliação' },
};
const VERDICT: Record<PlanEvaluation['verdict'], { label: string; color: string; icon: IconName }> = {
  improved: { label: 'Melhorou', color: colors.good, icon: 'trending-up' },
  same: { label: 'Estável', color: colors.textSecondary, icon: 'remove' },
  worse: { label: 'Piorou', color: colors.loss, icon: 'trending-down' },
  insufficient: { label: 'Aguardando partidas', color: colors.warning, icon: 'hourglass-outline' },
};
const WEEK = 7 * 86_400_000;

export function TrainingPlanScreen() {
  return (
    <Screen title="Plano de treinamento" subtitle="Uma semana, um foco" back>
      <CoachGate>{(report) => <Content report={report} />}</CoachGate>
    </Screen>
  );
}

function Content({ report }: { report: CoachReport }) {
  const router = useRouter();
  const { setPlanDay } = useCoach();
  const plan = report.plan;
  if (!plan) {
    return (
      <Card>
        <EmptyState icon="calendar-outline" title="Sem plano ativo" message="O plano é criado quando o treinador analisa a sua conta." />
      </Card>
    );
  }
  const done = plan.days.filter((d) => d.done).length;
  const ev = plan.evaluation;
  const verdict = ev ? VERDICT[ev.verdict] : null;
  const daysLeft = Math.max(0, Math.ceil((plan.createdAt + WEEK - report.generatedAt) / 86_400_000));

  return (
    <>
      <Card style={{ borderColor: 'rgba(201,164,92,0.4)' }}>
        <Text style={[type.label, { color: colors.gold }]}>Foco: {SKILLS[plan.focus].name}</Text>
        <Text style={[type.h1, { marginTop: 2 }]}>{plan.title}</Text>
        <Text style={[type.bodySm, { marginTop: 4 }]}>{plan.objective}</Text>
        <View style={styles.progress}>
          <Meter value={done / 7} color={colors.gold} />
          <Text style={type.bodySm}>
            {done} de 7 dias · iniciado em {dateShort(plan.createdAt)} · {daysLeft > 0 ? `renova em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}` : 'renova na próxima atualização'}
          </Text>
        </View>
        <View style={styles.tiles}>
          <View style={styles.goalRow}>
            <Text style={[type.label, { width: 96 }]}>Linha de base</Text>
            <Text style={[type.h3, { flex: 1 }]}>{plan.baseline === null ? 'Sem amostra suficiente' : plan.baselineDisplay}</Text>
          </View>
          <View style={styles.goalRow}>
            <Text style={[type.label, { width: 96, color: colors.gold }]}>Meta da semana</Text>
            <Text style={[type.h3, { flex: 1 }]}>{plan.target === null ? 'Definida quando houver amostra' : plan.targetDisplay}</Text>
          </View>
        </View>
      </Card>

      <View>
        <SectionHeader title="Dias" subtitle="Aulas são marcadas sozinhas ao concluir o teste; os demais dias você marca" />
        <View style={{ gap: space.sm }}>
          {plan.days.map((d) => {
            const kind = KIND[d.kind];
            const isLesson = d.kind === 'lesson' && !!d.lessonId;
            const openLesson = d.lessonId ? () => router.push({ pathname: '/academy/aula/[id]', params: { id: d.lessonId! } }) : undefined;
            return (
              <View key={d.day} style={[styles.day, d.done && { borderColor: 'rgba(47,179,128,0.45)' }]}>
                <Pressable
                  disabled={isLesson}
                  onPress={() => void setPlanDay(d.day, !d.done)}
                  hitSlop={8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: d.done, disabled: isLesson }}
                  accessibilityLabel={`Dia ${d.day}: ${d.title}`}
                  style={[styles.check, d.done && styles.checkOn, isLesson && !d.done && { opacity: 0.5 }]}>
                  {d.done ? <Ionicons name="checkmark" size={15} color={colors.bg} /> : <Text style={styles.checkText}>{d.day}</Text>}
                </Pressable>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.kind}>
                    <Ionicons name={kind.icon} size={12} color={colors.textMuted} />
                    <Text style={type.label}>
                      Dia {d.day} · {kind.label}
                    </Text>
                  </View>
                  <Text style={[type.h3, d.done && { color: colors.textSecondary }]}>{d.title}</Text>
                  <Text style={type.bodySm}>{d.description}</Text>
                  {openLesson ? (
                    <Pressable onPress={openLesson} accessibilityRole="button" hitSlop={6} style={styles.open}>
                      <Text style={styles.openText}>{d.kind === 'lesson' ? (d.done ? 'Rever aula' : 'Abrir aula') : 'Ver exercício na aula'}</Text>
                      <Ionicons name="chevron-forward" size={12} color={colors.accentSoft} />
                    </Pressable>
                  ) : d.kind === 'review' ? (
                    <Pressable onPress={() => router.navigate('/desempenho')} accessibilityRole="button" hitSlop={6} style={styles.open}>
                      <Text style={styles.openText}>Abrir Desempenho</Text>
                      <Ionicons name="chevron-forward" size={12} color={colors.accentSoft} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {ev && verdict ? (
        <Card>
          <SectionHeader title="Avaliação de evolução" subtitle={plan.metricLabel} />
          <View style={styles.verdict}>
            <Ionicons name={verdict.icon} size={18} color={verdict.color} />
            <Text style={[type.h3, { color: verdict.color }]}>{verdict.label}</Text>
          </View>
          <Text style={[type.bodySm, { marginTop: 6 }]}>{ev.text}</Text>
          {report.source === 'demo' && ev.verdict === 'insufficient' ? (
            <Text style={[type.bodySm, { marginTop: 6 }]}>No modo demonstração as partidas são fixas, então a avaliação prática não avança. Com dados reais ela usa as partidas jogadas depois do início do plano.</Text>
          ) : null}
        </Card>
      ) : null}

      {report.pastPlans.length ? (
        <Card>
          <SectionHeader title="Semanas anteriores" />
          <View style={{ gap: 2 }}>
            {[...report.pastPlans].reverse().map((p) => (
              <View key={p.id} style={styles.past}>
                <Text style={[type.bodySm, { width: 56 }]}>{dateShort(p.createdAt)}</Text>
                <Text style={[type.h3, { flex: 1 }]}>{SKILLS[p.focus].name}</Text>
                <Text style={type.bodySm}>{p.completedDays}/7 dias</Text>
                <Text style={[styles.pastVerdict, { color: VERDICT[p.verdict].color }]}>{VERDICT[p.verdict].label}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <Text style={[type.bodySm, { textAlign: 'center' }]}>
        O plano se renova a cada 7 dias. O próximo foco é escolhido pelo diagnóstico mais recente e só se repete se a habilidade continuar sendo a mais crítica.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  progress: { gap: 6, marginTop: space.lg },
  tiles: { gap: 2, marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  goalRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, paddingVertical: 6 },
  day: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  check: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: colors.border, marginTop: 2 },
  checkOn: { backgroundColor: colors.good, borderColor: colors.good },
  checkText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.textMuted },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  open: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4, alignSelf: 'flex-start' },
  openText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.accentSoft },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  past: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  pastVerdict: { width: 76, textAlign: 'right', fontFamily: fonts.bodySemi, fontSize: 11.5 },
});
