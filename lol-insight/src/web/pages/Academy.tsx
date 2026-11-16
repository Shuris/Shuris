import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORIES, CATEGORY_IDS, LESSONS, lessonById, SKILLS } from '@/coach';
import type { CoachReport } from '@/coach/types';
import { CoachGate } from '@/components/coach/CoachGate';
import { dateTime, pct } from '@/stats/format';
import { colors, fonts, radius } from '@/theme';

import { Button, Cols, css, DataTable, Kpi, KpiStrip, MiniBar, Page, Panel, Split, T, Tag, type WebPress } from './kit';

/** LOI Academy na web: diagnóstico, evolução do conhecimento, aulas por categoria e histórico. */
export function WebAcademy() {
  const router = useRouter();
  return (
    <Page eyebrow="LOI Academy" title="Treinamento guiado" subtitle="Aulas escolhidas a partir das dificuldades que aparecem nas suas partidas" actions={<Button kind="ghost" icon="calendar-outline" label="Plano da semana" onPress={() => router.push('/academy/plano')} />}>
      <CoachGate>{(r) => <Content r={r} />}</CoachGate>
    </Page>
  );
}



function Content({ r }: { r: CoachReport }) {
  const router = useRouter();
  const a = r.academy;
  const open = (id: string) => router.push({ pathname: '/academy/aula/[id]', params: { id } });
  const attempts = Object.values(r.progress)
    .flatMap((p) => p.attempts.map((x) => ({ ...x, lessonId: p.lessonId })))
    .sort((x, y) => y.at - x.at);
  const weak = r.diagnosis.skills.filter((s) => s.status === 'weakness').sort((x, y) => y.severity - x.severity);
  return (
    <>
      <KpiStrip>
        <Kpi label="Nível" value={String(a.level.index)} hint={a.level.name} />
        <Kpi label="XP" value={String(a.level.xp)} hint={a.level.nextAt ? `próximo nível em ${a.level.nextAt}` : 'nível máximo'} />
        <Kpi label="Aulas concluídas" value={`${a.lessonsCompleted}/${a.lessonsTotal}`} />
        <Kpi label="Sequência de treino" value={`${a.streakDays} ${a.streakDays === 1 ? "dia" : "dias"}`} hint={a.trainedToday ? 'treinou hoje' : 'ainda não treinou hoje'} />
        <Kpi label="Aproveitamento nos testes" value={a.quizAverage === null ? '—' : pct(a.quizAverage)} />
      </KpiStrip>
      <Split>
        <Panel title="Recomendações para você" subtitle={r.diagnosis.enough ? `Com base em ${r.diagnosis.sample} partidas` : 'Partidas insuficientes para um diagnóstico completo'} info="O diagnóstico compara o seu desempenho com a referência da sua posição e do seu elo.">
          <View style={{ gap: 10 }}>
            {a.recommended.map((x) => {
              const l = lessonById(x.lessonId);
              if (!l) return null;
              return (
                <Pressable key={x.lessonId} onPress={() => open(l.id)} style={({ hovered }: WebPress) => [styles.rec, hovered && { backgroundColor: colors.surfaceHigh }, css({ cursor: 'pointer' })]} accessibilityRole="link" accessibilityLabel={`Aula ${l.title}`}>
                  <Ionicons name="school" size={18} color={colors.gold} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.recTitle}>{l.title}</Text>
                    <Text style={styles.recText}>{x.reason}</Text>
                  </View>
                  <Text style={styles.min}>{l.minutes} min</Text>
                </Pressable>
              );
            })}
          </View>
        </Panel>
        <Panel title="Pontos a corrigir" subtitle="Do mais para o menos urgente">
          {weak.length ? (
            weak.slice(0, 5).map((s) => (
              <View key={s.skill} style={styles.weak}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.recTitle}>{SKILLS[s.skill].name}</Text>
                  <Text style={styles.recText}>
                    {s.metricLabel}: {s.display} (referência {s.reference})
                  </Text>
                </View>
                <Tag text={`prioridade ${Math.round(s.severity)}`} color={colors.loss} />
              </View>
            ))
          ) : (
            <Text style={styles.recText}>Nenhum ponto fraco claro com a amostra atual.</Text>
          )}
        </Panel>
      </Split>
      <Panel title="Evolução do conhecimento" subtitle="Teoria (testes das aulas) × prática (desempenho nas partidas)" padded={false} info="Prática: 50 = referência da posição. A evolução compara as partidas antes e depois da primeira aula concluída da habilidade.">
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <DataTable
            minWidth={760}
            rows={a.mastery}
            rowKey={(m) => m.skill}
            columns={[
              { key: 's', label: 'Habilidade', flex: 1.4, render: (m) => <T strong>{SKILLS[m.skill].name}</T> },
              { key: 't', label: 'Teoria', flex: 1, render: (m) => (m.theory === null ? <T muted>sem aulas</T> : <View style={styles.barCell}><MiniBar value={m.theory} max={100} color={colors.gold} /><T>{String(Math.round(m.theory))}</T></View>), sort: (m) => m.theory ?? -1 },
              { key: 'p', label: 'Prática', flex: 1, render: (m) => (m.practice === null ? <T muted>amostra pequena</T> : <View style={styles.barCell}><MiniBar value={m.practice} max={100} /><T>{String(Math.round(m.practice))}</T></View>), sort: (m) => m.practice ?? -1 },
              { key: 'l', label: 'Aulas', width: 70, align: 'right', render: (m) => <T>{`${m.lessonsDone}/${m.lessonsTotal}`}</T> },
              { key: 'c', label: 'Evolução', flex: 1.4, render: (m) => <T color={m.practiceChange?.improved ? colors.good : m.practiceChange?.improved === false ? colors.loss : undefined} muted={!m.practiceChange}>{m.practiceChange?.text ?? '—'}</T> },
            ]}
          />
        </View>
      </Panel>
      <Cols lg={3} md={2}>
        {CATEGORY_IDS.map((cat) => {
          const list = LESSONS.filter((l) => l.category === cat);
          return (
            <Panel key={cat} title={CATEGORIES[cat].name} subtitle={`${list.filter((l) => r.progress[l.id]?.completedAt).length} de ${list.length} concluídas`}>
              <View style={{ gap: 6 }}>
                {list.map((l) => {
                  const p = r.progress[l.id];
                  return (
                    <Pressable key={l.id} onPress={() => open(l.id)} style={[styles.lesson, css({ cursor: 'pointer' })]} accessibilityRole="link" accessibilityLabel={`Aula ${l.title}`}>
                      <Ionicons name={p?.completedAt ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={p?.completedAt ? colors.good : colors.textMuted} />
                      <Text style={styles.lessonText} numberOfLines={1}>
                        {l.title}
                      </Text>
                      <Text style={styles.min}>{p ? pct(p.bestScore) : `nível ${l.level}`}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Panel>
          );
        })}
      </Cols>
      <Panel title="Histórico de aprendizado" subtitle="Todos os testes realizados" padded={false}>
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <DataTable
            minWidth={560}
            rows={attempts}
            rowKey={(x) => `${x.lessonId}-${x.at}`}
            empty="Nenhum teste realizado ainda."
            onRowPress={(x) => open(x.lessonId)}
            columns={[
              { key: 'd', label: 'Quando', width: 150, render: (x) => <T muted>{dateTime(x.at)}</T>, sort: (x) => x.at },
              { key: 'l', label: 'Aula', flex: 2, render: (x) => <T strong>{lessonById(x.lessonId)?.title ?? x.lessonId}</T> },
              { key: 's', label: 'Acertos', width: 90, align: 'right', render: (x) => <T color={x.correct / x.total >= 0.67 ? colors.good : colors.loss}>{`${x.correct}/${x.total}`}</T>, sort: (x) => x.correct / x.total },
              { key: 't', label: 'Tempo', width: 80, align: 'right', render: (x) => <T muted>{`${Math.round(x.durationSec / 60)} min`}</T> },
            ]}
          />
        </View>
      </Panel>
    </>
  );
}

const styles = StyleSheet.create({
  rec: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  recTitle: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.text },
  recText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary },
  min: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: colors.textMuted },
  weak: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  barCell: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' },
  lesson: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  lessonText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
});
