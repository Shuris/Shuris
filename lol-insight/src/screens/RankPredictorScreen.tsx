import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { lessonById, SKILLS, type CoachReport, type ConfidenceLevel, type Scenario } from '@/coach';
import { ProjectionChart } from '@/components/charts';
import { CoachGate } from '@/components/coach/CoachGate';
import { SourceBadge } from '@/components/SourceBadge';
import { Card, EmptyState, FadeIn, LinkButton, Meter, RankEmblem, Screen, SectionHeader, Segmented, Sheet, SheetOption, StatTile, TileGrid } from '@/components/ui';
import { useCoach } from '@/state/CoachContext';
import { dateShort, dec, pct } from '@/stats/format';
import { absoluteLabel, absoluteToRank, rankLabel, rankToAbsolute, TIER_COLOR } from '@/stats/rank';
import { colors, fonts, radius, space, type } from '@/theme';
import type { Rank } from '@/types';

const CONFIDENCE: Record<ConfidenceLevel, { color: string; value: number }> = {
  alta: { color: colors.good, value: 1 },
  média: { color: colors.warning, value: 0.62 },
  baixa: { color: colors.loss, value: 0.3 },
};
const SCENARIO_TINT: Record<Scenario['key'], string> = { conservative: colors.textSecondary, realistic: colors.series1, optimistic: colors.series2 };
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v))} LP`;
const MASTER = rankToAbsolute({ tier: 'MESTRE', division: 1, lp: 0 });

export function RankPredictorScreen() {
  return (
    <Screen title="Previsão de elo" subtitle="Rank Predictor" back right={<SourceBadge />}>
      <CoachGate>{(report) => <Content report={report} />}</CoachGate>
    </Screen>
  );
}

function Content({ report }: { report: CoachReport }) {
  const p = report.prediction;
  const [days, setDays] = useState<7 | 15 | 30>(30);

  if (p.status !== 'ok' || !p.inputs || !p.confidence || p.currentAbs === null || !p.currentRank) {
    return (
      <>
        <Card>
          <EmptyState icon={p.status === 'unranked' ? 'shield-outline' : 'hourglass-outline'} title={p.status === 'unranked' ? 'Conta sem elo' : 'Dados insuficientes para prever'} message={p.message ?? 'Ainda não há dados suficientes.'} />
        </Card>
        <Text style={[type.bodySm, { textAlign: 'center' }]}>O LOL Insight não apresenta projeções sem uma amostra mínima de partidas ranqueadas.</Text>
      </>
    );
  }

  const horizon = p.horizons.find((h) => h.days === days)!;
  const conf = CONFIDENCE[p.confidence.level];
  const central = absoluteToRank(horizon.central);

  return (
    <>
      {/* Elo atual e leitura principal */}
      <Card>
        <View style={styles.now}>
          <RankEmblem rank={p.currentRank} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={type.label}>Elo atual</Text>
            <Text style={[type.h1, { color: TIER_COLOR[p.currentRank.tier] }]}>{rankLabel(p.currentRank)}</Text>
            <Text style={type.bodySm}>{p.currentRank.lp} LP</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={type.label}>Confiança</Text>
            <Text style={[type.h3, { color: conf.color, textTransform: 'capitalize' }]}>{p.confidence.level}</Text>
          </View>
        </View>
        <Text style={styles.headline}>{p.headline}</Text>
      </Card>

      {/* Horizonte */}
      <Card>
        <SectionHeader title="Projeção" subtitle="Mediana e intervalo de 80% das simulações do cenário realista" />
        <Segmented
          options={[
            { value: 7, label: '7 dias' },
            { value: 15, label: '15 dias' },
            { value: 30, label: '30 dias' },
          ]}
          value={days}
          onChange={setDays}
        />
        <FadeIn trigger={days} style={styles.central}>
          <Text style={type.label}>Projeção central em {days} dias</Text>
          <Text style={[styles.centralRank, { color: TIER_COLOR[central.tier] }]}>{rankLabel(central)}</Text>
          <Text style={type.bodySm}>
            {central.lp} LP · {signed(horizon.central - p.currentAbs)} em relação a hoje · ≈ {horizon.expectedGames} partidas
          </Text>
          <View style={styles.range}>
            <View style={{ flex: 1 }}>
              <Text style={type.label}>Limite inferior</Text>
              <Text style={type.h3}>{absoluteLabel(horizon.low)}</Text>
            </View>
            <Ionicons name="swap-horizontal" size={16} color={colors.textMuted} />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={type.label}>Limite superior</Text>
              <Text style={type.h3}>{absoluteLabel(horizon.high)}</Text>
            </View>
          </View>
        </FadeIn>
        {horizon.high >= MASTER ? <Text style={[type.bodySm, { marginTop: space.sm }]}>Acima de Mestre o app não distingue Grão-Mestre e Desafiante, que dependem da posição no servidor.</Text> : null}
      </Card>

      {/* Gráfico */}
      <Card>
        <SectionHeader title="Progressão projetada" subtitle="Próximos 30 dias · linhas horizontais marcam as divisões" />
        <ProjectionChart path={p.path} goalAbs={report.goal?.targetAbs} />
      </Card>

      {/* Cenários */}
      <View>
        <SectionHeader title="Três cenários" subtitle={`Em ${days} dias`} />
        <FadeIn trigger={days} style={{ gap: space.sm }}>
          {horizon.scenarios.map((s) => (
            <ScenarioCard key={s.key} scenario={s} />
          ))}
        </FadeIn>
      </View>

      {/* Confiança */}
      <Card>
        <SectionHeader title="Grau de confiança" subtitle="Quanto os dados disponíveis sustentam a projeção" />
        <View style={styles.confRow}>
          <Text style={[type.h1, { color: conf.color, textTransform: 'capitalize' }]}>{p.confidence.level}</Text>
          <View style={{ flex: 1 }}>
            <Meter value={p.confidence.score / 100} color={conf.color} />
          </View>
        </View>
        <View style={{ gap: 6, marginTop: space.md }}>
          {p.confidence.reasons.map((r) => (
            <View key={r} style={styles.reason}>
              <Ionicons name="ellipse" size={5} color={colors.textMuted} style={{ marginTop: 7 }} />
              <Text style={[type.bodySm, { flex: 1 }]}>{r}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Indicadores */}
      <Card>
        <SectionHeader title="Indicadores usados" subtitle={`${p.inputs.rankedGames} ranqueadas Solo/Duo analisadas`} />
        <Text style={[type.label, { marginBottom: 8 }]}>Taxa de vitória por janela</Text>
        <TileGrid columns={4}>
          {p.inputs.winRates.map((w) => (
            <StatTile key={w.window} label={`Últ. ${w.window}`} value={w.winRate === null ? '—' : pct(w.winRate)} hint={w.winRate === null ? `há ${w.games}` : 'vitórias'} />
          ))}
        </TileGrid>
        <View style={{ height: space.sm }} />
        <TileGrid columns={2}>
          <StatTile label="Taxa ponderada" value={pct(p.inputs.weightedWinRate, 1)} hint="recentes pesam mais" />
          <StatTile label="Taxa usada" value={pct(p.inputs.smoothedWinRate, 1)} hint={`suavizada · ±${dec(p.inputs.stdError * 100, 1)} p.p.`} />
          <StatTile label="Ritmo" value={`${dec(p.inputs.gamesPerWeek, 1)}`} hint="ranqueadas por semana" />
          <StatTile label="LP por partida" value={`+${Math.round(p.inputs.lpGain)} / −${Math.round(p.inputs.lpLoss)}`} hint={p.inputs.lpSource === 'observed' ? 'medido no histórico' : 'valor neutro'} />
        </TileGrid>
        <View style={{ gap: 6, marginTop: space.md }}>
          <Text style={type.bodySm}>Ritmo: {p.inputs.gamesPerWeekBasis}.</Text>
          <Text style={type.bodySm}>{p.inputs.lpSourceText}</Text>
          <Text style={type.bodySm}>{p.inputs.trendText}</Text>
          {Math.abs(p.inputs.currentStreak) >= 2 ? (
            <Text style={type.bodySm}>
              Sequência atual: {Math.abs(p.inputs.currentStreak)} {p.inputs.currentStreak > 0 ? 'vitórias' : 'derrotas'} seguidas.
            </Text>
          ) : null}
        </View>
      </Card>

      <GoalCard report={report} />
      <HistoryCard report={report} />

      <Text style={[type.bodySm, { textAlign: 'center' }]}>
        Projeção estatística, não garantia. O MMR não é divulgado pela Riot e não é conhecido pelo aplicativo. A previsão é recalculada sempre que novas partidas são carregadas.
      </Text>
    </>
  );
}

function ScenarioCard({ scenario: s }: { scenario: Scenario }) {
  const [open, setOpen] = useState(false);
  const rank = absoluteToRank(s.projectedAbs);
  const conf = CONFIDENCE[s.confidence];
  return (
    <View style={[styles.scenario, s.key === 'realistic' && { borderColor: 'rgba(57,135,229,0.55)' }]}>
      <View style={[styles.scenarioStripe, { backgroundColor: SCENARIO_TINT[s.key] }]} />
      <View style={styles.rowBetween}>
        <Text style={type.label}>Cenário {s.label.toLowerCase()}</Text>
        <Text style={[type.label, { color: conf.color }]}>confiança {s.confidence}</Text>
      </View>
      <View style={styles.scenarioMain}>
        <View style={{ flex: 1 }}>
          <Text style={[type.h2, { color: TIER_COLOR[rank.tier] }]}>{rankLabel(rank)}</Text>
          <Text style={type.bodySm}>
            {rank.lp} LP · {signed(s.lpChange)}
          </Text>
        </View>
        <View style={styles.scenarioStat}>
          <Text style={type.h3}>{pct(s.winRate, 1)}</Text>
          <Text style={type.bodySm}>vitórias</Text>
        </View>
        <View style={styles.scenarioStat}>
          <Text style={type.h3}>{s.games}</Text>
          <Text style={type.bodySm}>partidas</Text>
        </View>
      </View>
      <Text style={type.bodySm}>
        De {absoluteLabel(s.currentAbs)} para {absoluteLabel(s.projectedAbs)}.
      </Text>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} hitSlop={6} style={styles.toggle}>
        <Text style={styles.toggleText}>{open ? 'Ocultar cálculo' : 'Como foi calculado'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={colors.accentSoft} />
      </Pressable>
      {open ? (
        <View style={styles.steps}>
          {s.explanation.map((line, i) => (
            <View key={i} style={styles.reason}>
              <Text style={styles.stepIndex}>{i + 1}</Text>
              <Text style={[type.bodySm, { flex: 1 }]}>{line}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** "O que falta para chegar lá?" — meta de elo, obstáculos e aulas relacionadas. */
function GoalCard({ report }: { report: CoachReport }) {
  const { setGoal } = useCoach();
  const router = useRouter();
  const [picker, setPicker] = useState(false);
  const current = report.prediction.currentAbs ?? 0;
  const g = report.goal;

  // Opções: cada divisão acima do elo atual, até Mestre.
  const options = useMemo(() => {
    const list: Rank[] = [];
    for (let abs = Math.floor(current / 100) * 100 + 100; abs <= MASTER && list.length < 16; abs += 100) list.push(absoluteToRank(abs));
    return list;
  }, [current]);

  return (
    <Card style={{ borderColor: 'rgba(201,164,92,0.4)' }}>
      <SectionHeader
        title="O que falta para chegar lá?"
        subtitle={g ? `Meta: ${rankLabel(g.target)}` : 'Escolha um elo e veja o caminho até ele'}
        right={<LinkButton label={g ? 'Alterar meta' : 'Definir meta'} onPress={() => setPicker(true)} />}
      />
      {!g ? (
        <EmptyState icon="flag-outline" title="Nenhuma meta definida" message="Defina um elo desejado para calcular a distância, as partidas necessárias e a taxa de vitória exigida." actionLabel="Definir meta" onAction={() => setPicker(true)} />
      ) : (
        <>
          <View style={styles.goalHead}>
            <RankEmblem rank={g.target} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={[type.h2, { color: TIER_COLOR[g.target.tier] }]}>{rankLabel(g.target)}</Text>
              <Text style={type.bodySm}>{g.reached ? 'Meta atingida' : `Faltam ${g.distance} LP`}</Text>
            </View>
            {!g.reached ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={type.number}>{pct(g.probability30)}</Text>
                <Text style={type.bodySm}>chance em 30 dias</Text>
              </View>
            ) : null}
          </View>
          <View style={{ gap: 6, marginTop: space.md }}>
            {g.summary.map((line) => (
              <Text key={line} style={styles.goalLine}>
                {line}
              </Text>
            ))}
          </View>

          {!g.reached ? (
            <>
              <TileGrid columns={3}>
                <StatTile label="Distância" value={`${g.distance}`} hint="LP" />
                <StatTile label="Partidas" value={g.gamesNeeded === null ? '—' : `${g.gamesNeeded}`} hint={g.gamesNeeded === null ? 'tendência não leva' : 'no ritmo atual'} />
                <StatTile label="Sua taxa" value={pct(g.currentWinRate, 1)} hint={`${signed(g.lpPerGame)}/partida`} />
              </TileGrid>

              <Text style={[type.h3, styles.sub]}>Taxa de vitória necessária</Text>
              <View style={{ gap: 2 }}>
                {g.requiredWinRates.map((r) => (
                  <View key={r.games} style={styles.required}>
                    <Text style={[type.bodySm, { flex: 1 }]}>{r.label}</Text>
                    <Text style={[type.h3, !r.feasible && { color: colors.loss }]}>{r.winRate > 1 ? 'acima de 100%' : pct(r.winRate, 1)}</Text>
                    {!r.feasible ? <Ionicons name="alert-circle-outline" size={14} color={colors.loss} /> : null}
                  </View>
                ))}
              </View>
              <Text style={[type.bodySm, { marginTop: 6 }]}>Premissas: LP por partida como estimado acima e resultados independentes. Taxas acima de 65% raramente se sustentam por muitas partidas.</Text>

              <Text style={[type.h3, styles.sub]}>Principais obstáculos</Text>
              {g.obstacles.length ? (
                <View style={{ gap: space.md }}>
                  {g.obstacles.map((o) => (
                    <View key={o.skill} style={styles.obstacle}>
                      <Text style={type.h3}>{SKILLS[o.skill].name}</Text>
                      <Text style={type.bodySm}>{o.text}</Text>
                      <View style={styles.lessonLinks}>
                        {o.lessonIds.map((id) => {
                          const lesson = lessonById(id);
                          return lesson ? (
                            <Pressable key={id} onPress={() => router.push({ pathname: '/academy/aula/[id]', params: { id } })} accessibilityRole="button" style={({ pressed }) => [styles.lessonLink, pressed && { opacity: 0.7 }]}>
                              <Ionicons name="book-outline" size={12} color={colors.accentSoft} />
                              <Text style={styles.lessonLinkText} numberOfLines={1}>
                                {lesson.title}
                              </Text>
                            </Pressable>
                          ) : null;
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={type.bodySm}>
                  {report.diagnosis.enough ? 'O diagnóstico não encontrou pontos fracos claros. O caminho é manter a regularidade e o volume de partidas.' : 'Ainda não há partidas suficientes para apontar obstáculos.'}
                </Text>
              )}
              <View style={{ marginTop: space.md }}>
                <LinkButton label="Abrir a Academy" onPress={() => router.push('/academy')} />
              </View>
            </>
          ) : null}
          <Pressable onPress={() => void setGoal(null)} accessibilityRole="button" hitSlop={8} style={{ marginTop: space.md, alignSelf: 'flex-start' }}>
            <Text style={styles.remove}>Remover meta</Text>
          </Pressable>
        </>
      )}

      <Sheet visible={picker} title="Qual elo você quer alcançar?" onClose={() => setPicker(false)}>
        {options.map((r) => (
          <SheetOption
            key={rankToAbsolute(r)}
            label={rankLabel(r)}
            detail={`${rankToAbsolute(r) - current} LP`}
            selected={!!g && rankToAbsolute(g.target) === rankToAbsolute(r)}
            left={<RankEmblem rank={r} size={26} />}
            onPress={() => {
              setPicker(false);
              void setGoal(r);
            }}
          />
        ))}
        {!options.length ? <Text style={[type.bodySm, { padding: space.md }]}>Você já está no topo das ligas com divisões.</Text> : null}
      </Sheet>
    </Card>
  );
}

function HistoryCard({ report }: { report: CoachReport }) {
  const list = [...report.predictionHistory].reverse().slice(0, 8);
  const current = report.prediction.currentAbs;
  const now = report.generatedAt;
  return (
    <Card>
      <SectionHeader title="Previsões anteriores" subtitle="Uma previsão é registrada sempre que os dados mudam" />
      {list.length <= 1 ? (
        <Text style={type.bodySm}>
          {list.length ? `Primeira previsão registrada em ${dateShort(list[0].at)}. As próximas aparecem aqui, com o resultado real quando o prazo terminar.` : 'Nenhuma previsão registrada ainda.'}
        </Text>
      ) : null}
      <View style={{ gap: 2 }}>
        {list.map((rec, i) => {
          const h = rec.horizons.find((x) => x.days === 30);
          if (!h) return null;
          const due = rec.at + 30 * 86_400_000;
          const finished = now >= due && current !== null;
          const inside = finished && current! >= h.low && current! <= h.high;
          const daysLeft = Math.ceil((due - now) / 86_400_000);
          return (
            <View key={rec.at} style={styles.history}>
              <Text style={type.h3}>
                {dateShort(rec.at)}
                {i === 0 ? ' · atual' : ''}
              </Text>
              <Text style={type.bodySm}>
                Na data: {absoluteLabel(rec.currentAbs)} · {pct(rec.winRate, 1)} de vitórias · {rec.rankedGames} partidas
              </Text>
              <Text style={type.bodySm}>
                30 dias: {absoluteLabel(h.central)} (entre {absoluteLabel(h.low)} e {absoluteLabel(h.high)})
              </Text>
              <Text style={[type.bodySm, finished && { color: inside ? colors.good : colors.loss }]}>
                {finished ? `Resultado: ${absoluteLabel(current!)} — ${inside ? 'dentro' : 'fora'} do intervalo previsto.` : `Em andamento: faltam ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}.`}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  now: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headline: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginTop: space.lg, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  central: { alignItems: 'center', gap: 4, marginTop: space.lg },
  centralRank: { fontFamily: fonts.title, fontSize: 30, letterSpacing: 0.2 },
  range: { flexDirection: 'row', alignItems: 'center', gap: space.md, alignSelf: 'stretch', marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderSoft },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  scenario: { gap: 8, paddingVertical: space.md, paddingRight: space.lg, paddingLeft: space.lg + 3, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  scenarioStripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  scenarioMain: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  scenarioStat: { alignItems: 'flex-end', minWidth: 58 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  toggleText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.accentSoft },
  steps: { gap: 8, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  stepIndex: { width: 16, fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.gold, marginTop: 1 },
  confRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  reason: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  goalHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  goalLine: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary },
  sub: { marginTop: space.xl, marginBottom: space.sm },
  required: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  obstacle: { gap: 5, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderSoft },
  lessonLinks: { gap: 6, marginTop: 4 },
  lessonLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 32, borderRadius: 16, backgroundColor: colors.accentDim, alignSelf: 'flex-start', maxWidth: '100%' },
  lessonLinkText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.text, flexShrink: 1 },
  remove: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.textMuted },
  history: { gap: 3, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
});
