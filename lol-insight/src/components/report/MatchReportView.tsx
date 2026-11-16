import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LineChart } from '@/components/charts';
import { DIFFICULTY_COLOR, MatchupEditor } from '@/components/matchups/MatchupEditor';
import { Card, EmptyState, PressableScale, SectionHeader, Skeleton, StatTile, TileGrid } from '@/components/ui';
import { lessonById } from '@/coach/lessons';
import { champion } from '@/data/champions';
import { useMatchAnalysis } from '@/hooks/useMatchAnalysis';
import { useMatchups } from '@/hooks/useMatchups';
import { DIFFICULTY_LABEL } from '@/services/matchupNotes';
import { describeError } from '@/services';
import { axisCompact, int, signed } from '@/stats/format';
import { buildMatchReport, type ReportPoint } from '@/stats/matchReport';
import { colors, fonts, radius, space, type } from '@/theme';
import type { Match, Tier } from '@/types';

import { DeathMap } from './DeathMap';

/** Relatório pós-partida: manchete, três pontos principais, diferença de ouro e mapa das mortes. */
export function MatchReportView({ match, tier }: { match: Match; tier?: Tier | null }) {
  const state = useMatchAnalysis(match);
  const analysis = state.status === 'ready' ? state.analysis : null;
  const report = useMemo(() => buildMatchReport(match, analysis, tier), [match, analysis, tier]);

  if (state.status === 'loading') {
    return (
      <Card>
        <View style={{ gap: 10 }} accessibilityLabel="Gerando relatório">
          <Skeleton width="80%" height={18} />
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      </Card>
    );
  }

  const goldPoints = analysis?.frames.map((f) => ({
    y: f.goldDiff,
    xLabel: `${f.minute} min`,
    title: `${f.minute} min`,
    detail: `${signed(f.goldDiff)} de ouro · ${signed(f.csDiff)} CS em relação a ${report.opponentName}`,
  }));

  return (
    <View style={{ gap: space.lg }}>
      <Card style={styles.hero}>
        <View style={styles.heroHead}>
          <Ionicons name="sparkles" size={14} color={colors.gold} />
          <Text style={[type.label, { color: colors.gold }]}>Relatório pós-partida</Text>
        </View>
        <Text style={styles.headline}>{report.headline}</Text>
        <View style={{ gap: space.sm, marginTop: space.md }}>
          {report.points.length ? (
            report.points.map((p, i) => <PointRow key={p.key} point={p} index={i + 1} />)
          ) : (
            <Text style={type.bodySm}>Nenhum ponto de destaque nesta partida.</Text>
          )}
        </View>
        {!report.complete ? (
          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
            <Text style={[type.bodySm, { flex: 1 }]}>
              {state.status === 'error'
                ? `Relatório parcial: ${state.error.message} ${describeError(state.error.code).hint}`
                : 'Relatório parcial: a linha do tempo detalhada desta partida não está disponível.'}
            </Text>
          </View>
        ) : null}
      </Card>

      {analysis && report.at10 ? (
        <Card>
          <SectionHeader title="Fase de rotas" subtitle={`Diferença para ${report.opponentName}, seu oponente direto`} />
          <TileGrid columns={2}>
            <StatTile label="Ouro aos 10 min" value={signed(report.at10.gold)} hint={`${signed(report.at10.cs)} CS`} />
            {report.at15 ? <StatTile label={`Ouro aos ${report.at15.minute} min`} value={signed(report.at15.gold)} hint={`${signed(report.at15.cs)} CS`} /> : null}
          </TileGrid>
          {goldPoints && goldPoints.length > 2 ? (
            <View style={{ marginTop: space.lg }}>
              <LineChart points={goldPoints} yFormat={axisCompact} reference={{ y: 0, label: 'Empate' }} color={colors.gold} height={170} label="Diferença de ouro" />
            </View>
          ) : null}
        </Card>
      ) : null}

      {analysis ? (
        <Card>
          <SectionHeader title="Mapa das mortes" subtitle={`${int(analysis.deaths.length)} mortes e ${int(analysis.kills.length)} abates · ${analysis.wardsPlaced.length} sentinelas colocadas`} />
          {analysis.deaths.length || analysis.kills.length ? <DeathMap analysis={analysis} /> : <EmptyState icon="happy-outline" title="Nenhuma morte" message="Partida sem mortes: nada a marcar no mapa." />}
        </Card>
      ) : null}

      <NotebookCard match={match} />

      {report.improvements.length + report.strengths.length > report.points.length ? (
        <Card>
          <SectionHeader title="Outros pontos" subtitle="Também observados nesta partida" />
          <View style={{ gap: space.sm }}>
            {[...report.improvements, ...report.strengths]
              .filter((p) => !report.points.includes(p))
              .map((p) => (
                <PointRow key={p.key} point={p} />
              ))}
          </View>
        </Card>
      ) : null}
    </View>
  );
}

/** Anotação do caderno para o confronto desta partida. */
function NotebookCard({ match }: { match: Match }) {
  const mu = useMatchups();
  const [open, setOpen] = useState(false);
  if (!mu.available) return null;
  const note = mu.find(match.championId, match.opponentChampionId);
  const opp = champion(match.opponentChampionId).name;
  return (
    <Card>
      <SectionHeader title="Caderno de matchups" subtitle={`${champion(match.championId).name} contra ${opp}`} />
      {note ? (
        <View style={{ gap: 6 }}>
          <Text style={[type.label, { color: DIFFICULTY_COLOR[note.difficulty] }]}>{DIFFICULTY_LABEL[note.difficulty]}</Text>
          <Text style={[type.body, { color: colors.textSecondary }]}>{note.note || 'Sem texto.'}</Text>
        </View>
      ) : (
        <Text style={type.bodySm}>Nenhuma anotação para este confronto. Registre o que aprendeu enquanto a partida está fresca na memória.</Text>
      )}
      <PressableScale onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={note ? 'Editar anotação' : 'Anotar confronto'} style={styles.noteBtn}>
        <Ionicons name={note ? 'create-outline' : 'add'} size={16} color={colors.accentSoft} />
        <Text style={styles.lessonText}>{note ? 'Editar anotação' : `Anotar confronto contra ${opp}`}</Text>
      </PressableScale>
      <MatchupEditor matchups={mu} championId={match.championId} opponentId={open ? match.opponentChampionId : null} onClose={() => setOpen(false)} />
    </Card>
  );
}

function PointRow({ point: p, index }: { point: ReportPoint; index?: number }) {
  const router = useRouter();
  const lesson = p.lessonId ? lessonById(p.lessonId) : undefined;
  const good = p.tone === 'good';
  return (
    <View style={styles.point}>
      <View style={[styles.badge, { backgroundColor: good ? 'rgba(47,179,128,0.14)' : colors.lossDim }]}>
        {index ? (
          <Text style={[styles.badgeText, { color: good ? colors.good : colors.loss }]}>{index}</Text>
        ) : (
          <Ionicons name={good ? 'checkmark' : 'alert'} size={13} color={good ? colors.good : colors.loss} />
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={type.h3}>{p.title}</Text>
        <Text style={type.bodySm}>{p.detail}</Text>
        {lesson ? (
          <PressableScale onPress={() => router.push({ pathname: '/academy/aula/[id]', params: { id: lesson.id } })} accessibilityRole="button" accessibilityLabel={`Aula: ${lesson.title}`} style={styles.lesson}>
            <Ionicons name="school-outline" size={12} color={colors.accentSoft} />
            <Text style={styles.lessonText} numberOfLines={1}>
              {lesson.title}
            </Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderColor: 'rgba(201,164,92,0.35)' },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space.sm },
  headline: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22, color: colors.text },
  point: { flexDirection: 'row', gap: space.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md },
  badge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  badgeText: { fontFamily: fonts.displayBold, fontSize: 15 },
  lesson: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, alignSelf: 'flex-start' },
  lessonText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.accentSoft, maxWidth: 240 },
  noteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md, alignSelf: 'flex-start', paddingVertical: 6 },
  note: { flexDirection: 'row', gap: 6, marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.borderSoft },
});
