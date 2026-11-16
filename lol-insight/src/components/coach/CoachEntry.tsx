import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SKILLS } from '@/coach';
import { Meter, SectionHeader, Skeleton } from '@/components/ui';
import { useCoach } from '@/state/CoachContext';
import { absoluteLabel } from '@/stats/rank';
import { colors, fonts, radius, space, type } from '@/theme';

/** Entrada do treinador na tela inicial: Academy e Previsão de elo, com um resumo de cada. */
export function CoachEntry() {
  const { report, loading, error } = useCoach();
  const router = useRouter();

  const focus = report?.diagnosis.weaknesses[0];
  const h30 = report?.prediction.status === 'ok' ? report.prediction.horizons.find((h) => h.days === 30) : undefined;

  return (
    <View>
      <SectionHeader title="Treinador" subtitle="Diagnóstico, aulas e previsão de elo a partir das suas partidas" />
      <View style={styles.row}>
        <Pressable onPress={() => router.push('/academy')} accessibilityRole="button" accessibilityLabel="Abrir a LOI Academy" style={({ pressed }) => [styles.card, styles.academy, pressed && { opacity: 0.85 }]}>
          <View style={styles.head}>
            <View style={[styles.icon, { backgroundColor: colors.goldDim }]}>
              <Ionicons name="school" size={17} color={colors.gold} />
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
          </View>
          <Text style={type.h3}>LOI Academy</Text>
          {report ? (
            <>
              <Text style={styles.value} numberOfLines={2}>
                {focus ? `Foco: ${SKILLS[focus].name.toLowerCase()}` : report.diagnosis.enough ? 'Siga a trilha' : 'Comece pela base'}
              </Text>
              <Meter value={report.academy.lessonsCompleted / report.academy.lessonsTotal} color={colors.gold} height={4} />
              <Text style={type.bodySm}>
                {report.academy.lessonsCompleted}/{report.academy.lessonsTotal} aulas · {report.academy.level.name}
              </Text>
            </>
          ) : (
            <Placeholder loading={loading} failed={!!error} />
          )}
        </Pressable>

        <Pressable onPress={() => router.push('/previsao')} accessibilityRole="button" accessibilityLabel="Abrir a previsão de elo" style={({ pressed }) => [styles.card, styles.predictor, pressed && { opacity: 0.85 }]}>
          <View style={styles.head}>
            <View style={[styles.icon, { backgroundColor: colors.accentDim }]}>
              <Ionicons name="trending-up" size={17} color={colors.accentSoft} />
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
          </View>
          <Text style={type.h3}>Previsão de elo</Text>
          {report ? (
            h30 ? (
              <>
                <Text style={styles.value} numberOfLines={2}>
                  {absoluteLabel(h30.central)}
                </Text>
                <Text style={type.bodySm}>projeção central em 30 dias · confiança {report.prediction.confidence?.level}</Text>
              </>
            ) : (
              <>
                <Text style={styles.value}>Sem projeção</Text>
                <Text style={type.bodySm} numberOfLines={3}>
                  {report.prediction.status === 'unranked' ? 'Conta sem elo Solo/Duo.' : 'Faltam partidas ranqueadas para projetar.'}
                </Text>
              </>
            )
          ) : (
            <Placeholder loading={loading} failed={!!error} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function Placeholder({ loading, failed }: { loading: boolean; failed: boolean }) {
  if (failed && !loading) return <Text style={type.bodySm}>Não foi possível carregar. Toque para tentar.</Text>;
  return (
    <View style={{ gap: 8 }}>
      <Skeleton height={16} width="80%" />
      <Skeleton height={10} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  card: { flex: 1, gap: 6, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, minHeight: 148 },
  academy: { borderColor: 'rgba(201,164,92,0.4)' },
  predictor: { borderColor: 'rgba(92,155,255,0.4)' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  icon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: fonts.bodyBold, fontSize: 15.5, lineHeight: 20, color: colors.text },
});
