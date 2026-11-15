import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CATEGORIES, CATEGORY_IDS, lessonById, LESSONS, lessonsByCategory, SKILLS, type CoachReport } from '@/coach';
import { CoachGate } from '@/components/coach/CoachGate';
import { CATEGORY_TINT, LessonCard } from '@/components/coach/LessonCard';
import { MasteryRow } from '@/components/coach/MasteryRow';
import { SourceBadge } from '@/components/SourceBadge';
import { Card, EmptyState, LinkButton, Meter, Screen, SectionHeader, StatTile, TileGrid } from '@/components/ui';
import { pct } from '@/stats/format';
import { colors, fonts, radius, space, type } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export function AcademyScreen() {
  return (
    <Screen title="LOI Academy" subtitle="Treinamento guiado pelas suas partidas" back right={<SourceBadge />}>
      <CoachGate>{(report) => <Content report={report} />}</CoachGate>
    </Screen>
  );
}

function Content({ report }: { report: CoachReport }) {
  const router = useRouter();
  const a = report.academy;
  const d = report.diagnosis;
  const open = (id: string) => router.push({ pathname: '/academy/aula/[id]', params: { id } });
  const weak = d.weaknesses.map((skill) => d.skills.find((s) => s.skill === skill)!);
  const completed = LESSONS.filter((l) => report.progress[l.id]?.completedAt);
  const focus = weak[0];

  return (
    <>
      {/* Saudação, nível e progresso */}
      <Card style={styles.hero}>
        <Text style={type.label}>Olá, {report.playerName}</Text>
        <Text style={[type.h1, { marginTop: 2 }]}>
          {focus ? `Seu foco agora: ${SKILLS[focus.skill].name.toLowerCase()}` : d.enough ? 'Nenhum ponto fraco claro' : 'Vamos começar pela base'}
        </Text>
        <Text style={[type.bodySm, { marginTop: 4 }]}>
          {focus
            ? focus.evidence
            : d.enough
              ? 'Suas métricas estão na referência ou acima dela. Siga a trilha para ampliar o repertório.'
              : `${d.note} Enquanto isso, a trilha geral está liberada.`}
        </Text>

        <View style={styles.level}>
          <View style={styles.levelBadge}>
            <Ionicons name="school" size={18} color={colors.gold} />
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <View style={styles.rowBetween}>
              <Text style={type.h3}>Nível {a.level.index + 1} · {a.level.name}</Text>
              <Text style={type.bodySm}>
                {a.level.xp} XP{a.level.nextAt ? ` / ${a.level.nextAt}` : ''}
              </Text>
            </View>
            <Meter value={a.level.progress} color={colors.gold} />
          </View>
        </View>

        <TileGrid columns={3}>
          <StatTile label="Aulas" value={`${a.lessonsCompleted}/${a.lessonsTotal}`} hint={pct(a.lessonsCompleted / a.lessonsTotal)} />
          <StatTile label="Sequência" value={`${a.streakDays}`} hint={a.streakDays === 1 ? 'dia de treino' : 'dias de treino'} />
          <StatTile label="Testes" value={a.quizAverage === null ? '—' : pct(a.quizAverage)} hint="acertos" />
        </TileGrid>
        {!a.trainedToday ? <Text style={[type.bodySm, { marginTop: space.md }]}>Você ainda não treinou hoje. Uma aula ou um dia do plano mantém a sequência.</Text> : null}
      </Card>

      {/* Habilidades a melhorar */}
      <View>
        <SectionHeader title="Habilidades para melhorar" subtitle={d.enough ? `Diagnóstico sobre ${d.sample} partidas, comparado à referência de cada posição` : undefined} />
        {!d.enough ? (
          <Card>
            <EmptyState icon="analytics-outline" title="Amostra insuficiente" message={d.note ?? 'Jogue mais partidas para liberar o diagnóstico.'} />
          </Card>
        ) : weak.length ? (
          <View style={{ gap: space.sm }}>
            {weak.map((s, i) => (
              <View key={s.skill} style={styles.weak}>
                <View style={styles.weakHead}>
                  <View style={styles.priority}>
                    <Text style={styles.priorityText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={type.h3}>{SKILLS[s.skill].name}</Text>
                    <Text style={type.bodySm}>{s.metricLabel}</Text>
                  </View>
                  {s.trend === 'down' ? <Ionicons name="trending-down" size={16} color={colors.loss} /> : null}
                  {s.trend === 'up' ? <Ionicons name="trending-up" size={16} color={colors.good} /> : null}
                </View>
                <Text style={styles.evidence}>{s.evidence}</Text>
                <Meter value={(s.practice ?? 0) / 100} color={colors.loss} height={5} />
                <Text style={type.bodySm}>Desempenho prático: {s.practice} de 100 (50 = referência da posição)</Text>
              </View>
            ))}
          </View>
        ) : (
          <Card>
            <EmptyState icon="checkmark-done-outline" title="Sem pontos fracos claros" message="Nenhuma habilidade ficou abaixo da referência com amostra suficiente. As recomendações abaixo seguem a trilha." />
          </Card>
        )}
      </View>

      {/* Aulas recomendadas */}
      <View>
        <SectionHeader title="Aulas recomendadas" subtitle="Escolhidas a partir do diagnóstico" right={<LinkButton label="Todas as aulas" onPress={() => router.push('/academy/aulas')} />} />
        <View style={{ gap: space.sm }}>
          {a.recommended.map((r) => {
            const lesson = lessonById(r.lessonId);
            return lesson ? <LessonCard key={r.lessonId} lesson={lesson} progress={report.progress[r.lessonId]} reason={r.reason} onPress={() => open(r.lessonId)} /> : null;
          })}
          {!a.recommended.length ? <Text style={type.bodySm}>Você concluiu todas as aulas. Reveja as de menor aproveitamento para fixar.</Text> : null}
        </View>
      </View>

      {/* Plano semanal */}
      {report.plan ? (
        <Pressable onPress={() => router.push('/academy/plano')} accessibilityRole="button" style={({ pressed }) => [styles.plan, pressed && { opacity: 0.85 }]}>
          <View style={styles.rowBetween}>
            <Text style={[type.label, { color: colors.gold }]}>Plano de treinamento</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
          </View>
          <Text style={type.h2}>{report.plan.title}</Text>
          <Text style={type.bodySm}>{report.plan.objective}</Text>
          <View style={styles.dots}>
            {report.plan.days.map((day) => (
              <View key={day.day} style={[styles.dot, day.done && { backgroundColor: colors.good, borderColor: colors.good }]}>
                <Text style={[styles.dotText, day.done && { color: colors.bg }]}>{day.day}</Text>
              </View>
            ))}
          </View>
          <Text style={type.bodySm}>
            {report.plan.days.filter((x) => x.done).length} de 7 dias concluídos · linha de base: {report.plan.baselineDisplay}
          </Text>
        </Pressable>
      ) : null}

      {/* Objetivos */}
      <Card>
        <SectionHeader title="Objetivos de aprendizagem" />
        <View style={{ gap: space.md }}>
          {a.objectives.map((o) => (
            <View key={o.id} style={{ gap: 5 }}>
              <View style={styles.rowBetween}>
                <Text style={[type.h3, { flex: 1 }]}>{o.title}</Text>
                {o.done ? <Ionicons name="checkmark-circle" size={16} color={colors.good} /> : null}
              </View>
              <Meter value={o.progress} color={o.done ? colors.good : colors.accent} height={5} />
              <Text style={type.bodySm}>{o.detail}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Domínio por habilidade */}
      <Card>
        <SectionHeader title="Domínio por habilidade" subtitle="Teoria (testes) e prática (partidas) são medidas separadas" />
        <View style={{ gap: space.lg }}>
          {a.mastery.map((m) => (
            <MasteryRow key={m.skill} mastery={m} />
          ))}
        </View>
        <Text style={[type.bodySm, { marginTop: space.lg }]}>Acertar um teste aumenta a teoria. A prática só muda quando as partidas mudam.</Text>
      </Card>

      {/* Categorias */}
      <View>
        <SectionHeader title="Categorias" />
        <View style={{ gap: space.sm }}>
          {CATEGORY_IDS.map((id) => {
            const list = lessonsByCategory(id);
            const n = list.filter((l) => report.progress[l.id]?.completedAt).length;
            return (
              <Pressable key={id} onPress={() => router.push({ pathname: '/academy/aulas', params: { categoria: id } })} accessibilityRole="button" style={({ pressed }) => [styles.category, pressed && { backgroundColor: colors.surfaceHigh }]}>
                <View style={[styles.catIcon, { backgroundColor: `${CATEGORY_TINT[id]}22` }]}>
                  <Ionicons name={CATEGORIES[id].icon as IconName} size={18} color={CATEGORY_TINT[id]} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.rowBetween}>
                    <Text style={type.h3}>{CATEGORIES[id].name}</Text>
                    <Text style={type.bodySm}>
                      {n}/{list.length}
                    </Text>
                  </View>
                  <Meter value={n / list.length} color={CATEGORY_TINT[id]} height={4} />
                  <Text style={type.bodySm} numberOfLines={2}>
                    {CATEGORIES[id].description}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Concluídas */}
      <View>
        <SectionHeader title="Aulas concluídas" subtitle={completed.length ? `${completed.length} ${completed.length === 1 ? 'aula' : 'aulas'}` : undefined} />
        {completed.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingRight: space.lg }}>
            {completed.map((l) => (
              <LessonCard key={l.id} lesson={l} progress={report.progress[l.id]} onPress={() => open(l.id)} compact />
            ))}
          </ScrollView>
        ) : (
          <Text style={type.bodySm}>Nenhuma aula concluída ainda. Uma aula conta como concluída ao acertar 60% do teste.</Text>
        )}
      </View>

      <Pressable onPress={() => router.push('/previsao')} accessibilityRole="button" style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
        <Ionicons name="trending-up" size={18} color={colors.accentSoft} />
        <View style={{ flex: 1 }}>
          <Text style={type.h3}>Previsão de elo</Text>
          <Text style={type.bodySm}>Veja para onde o seu desempenho atual aponta e o que falta para a sua meta.</Text>
        </View>
        <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { borderColor: 'rgba(201,164,92,0.35)' },
  level: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.lg, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  levelBadge: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.goldDim, borderWidth: 1, borderColor: 'rgba(201,164,92,0.45)' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  weak: { gap: 8, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  weakHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  priority: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lossDim },
  priorityText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.loss },
  evidence: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  plan: { gap: 6, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(201,164,92,0.4)' },
  dots: { flexDirection: 'row', gap: 6, marginVertical: 6 },
  dot: { flex: 1, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  dotText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.textMuted },
  category: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  catIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(92,155,255,0.4)' },
});
