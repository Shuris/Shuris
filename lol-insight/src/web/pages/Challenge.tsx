import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORY_IDS, CATEGORY_LABEL, challengeById, CHALLENGES, DIFFICULTY_IDS, DIFFICULTY_LABEL, type Challenge, type ChallengeCategory, type ChallengeDifficulty, type ChallengeState } from '@/challenge';
import { AuthPrompt } from '@/components/auth/AccountCard';
import { ChallengePlayer } from '@/components/challenge/ChallengePlayer';
import { ScreenSkeleton } from '@/components/ui';
import { useChallenge, type ChallengeHook } from '@/hooks/useChallenge';
import type { Ranking } from '@/services/challengeService';
import { pct } from '@/stats/format';
import { colors, fonts, radius } from '@/theme';

import { Button, Cols, css, DataTable, Dropdown, Kpi, KpiStrip, MiniBar, Page, Panel, Split, T, Tag, type Column, type WebPress } from './kit';

/** LOL Challenge: desafio diário, desafios extras, calendário, XP, conquistas e ranking. */
export function WebChallenge() {
  const ch = useChallenge();
  return (
    <Page eyebrow="LOL Challenge" title="Desafios de decisão" subtitle="Uma situação de jogo por dia, explicada. Responda rápido e aprenda com a correção.">
      {!ch.available ? <AuthPrompt /> : !ch.state ? ch.error ? <Panel><Text style={styles.err}>{ch.error}</Text></Panel> : <ScreenSkeleton cards={2} /> : <Body ch={ch} s={ch.state} />}
    </Page>
  );
}

function Body({ ch, s }: { ch: ChallengeHook; s: ChallengeState }) {
  const [current, setCurrent] = useState<{ c: Challenge; daily: boolean }>({ c: s.daily, daily: true });
  const previous = current.daily ? s.dailyAttempt : (s.attempts.find((a) => !a.daily && a.challengeId === current.c.id) ?? null);
  const demo = ch.service?.kind === 'demo';
  return (
    <>
      {demo ? (
        <View style={styles.demo}>
          <Ionicons name="flask" size={14} color={colors.gold} />
          <Text style={styles.demoText}>DEMO: o histórico anterior a hoje e o ranking são fictícios. As suas respostas ficam só neste navegador.</Text>
        </View>
      ) : null}
      <KpiStrip>
        <Kpi label="Nível" value={String(s.level.level)} hint={s.level.name} />
        <Kpi label="XP total" value={String(s.xp)} hint={`${s.level.to - s.xp} XP para o nível ${s.level.level + 1}`} />
        <Kpi label="Sequência" value={`${s.streak} ${s.streak === 1 ? "dia" : "dias"}`} hint={`recorde: ${s.bestStreak} ${s.bestStreak === 1 ? "dia" : "dias"}`} accent={s.streak ? colors.gold : undefined} />
        <Kpi label="Resolvidos" value={`${s.attempts.length}`} hint={`${s.attempts.filter((a) => a.correct).length} acertos`} />
        <Kpi label="Aproveitamento" value={s.attempts.length ? pct(s.attempts.filter((a) => a.correct).length / s.attempts.length) : '—'} />
      </KpiStrip>
      <View style={styles.levelBar}>
        <MiniBar value={s.level.progress} max={1} color={colors.gold} />
      </View>
      <Split>
        <Panel title={current.daily ? 'Desafio do dia' : 'Desafio'} subtitle={current.daily ? `Hoje, ${s.today.split('-').reverse().join('/')} · bônus de +15 XP` : 'Desafio adicional'} right={!current.daily ? <Button kind="ghost" label="Voltar ao diário" onPress={() => setCurrent({ c: s.daily, daily: true })} /> : undefined}>
          <ChallengePlayer challenge={current.c} daily={current.daily} previous={previous} onSubmit={(answer) => ch.submit(current.c.id, answer, current.daily)} />
          {ch.error ? <Text style={styles.err}>{ch.error}</Text> : null}
        </Panel>
        <View style={{ gap: 20 }}>
          <Calendar s={s} />
          <Achievements s={s} />
        </View>
      </Split>
      <Extra s={s} onPick={(c) => setCurrent({ c, daily: false })} />
      <Cols lg={2} md={1}>
        <Stats s={s} />
        <RankingPanel ch={ch} xp={s.xp} />
      </Cols>
      <History s={s} />
    </>
  );
}

function Calendar({ s }: { s: ChallengeState }) {
  const [y, m] = s.today.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const cells: Array<string | null> = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`)];
  const month = first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (
    <Panel title="Calendário" subtitle={month} info="Dourado: desafio diário respondido. Azul: só desafios extras.">
      <View style={styles.week}>
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <Text key={i} style={styles.weekDay}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((d, i) => {
          const info = d ? s.calendar[d] : undefined;
          const isToday = d === s.today;
          return (
            <View key={i} style={styles.cell} accessibilityLabel={d ? `${d}: ${info ? `${info.attempts} desafios, ${info.correct} acertos` : 'sem desafios'}` : undefined}>
              {d ? (
                <View style={[styles.day, info?.daily ? styles.dayDaily : info ? styles.dayExtra : null, isToday && styles.dayToday]}>
                  <Text style={[styles.dayText, info ? { color: colors.text } : null]}>{Number(d.slice(8))}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </Panel>
  );
}

function Achievements({ s }: { s: ChallengeState }) {
  return (
    <Panel title="Conquistas" subtitle={`${s.achievements.filter((a) => a.unlocked).length} de ${s.achievements.length}`}>
      <View style={{ gap: 8 }}>
        {s.achievements.map((a) => (
          <View key={a.id} style={[styles.ach, !a.unlocked && { opacity: 0.55 }]}>
            <Ionicons name={a.unlocked ? 'trophy' : 'trophy-outline'} size={18} color={a.unlocked ? colors.gold : colors.textMuted} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.achTitle}>{a.title}</Text>
              <Text style={styles.achDetail}>{a.detail}</Text>
              {!a.unlocked ? <MiniBar value={a.progress} max={1} color={colors.gold} /> : null}
            </View>
          </View>
        ))}
      </View>
    </Panel>
  );
}

function Extra({ s, onPick }: { s: ChallengeState; onPick: (c: Challenge) => void }) {
  const [cat, setCat] = useState<'ALL' | ChallengeCategory>('ALL');
  const [diff, setDiff] = useState<'ALL' | ChallengeDifficulty>('ALL');
  const done = new Map(s.attempts.filter((a) => !a.daily).map((a) => [a.challengeId, a]));
  const list = CHALLENGES.filter((c) => (cat === 'ALL' || c.category === cat) && (diff === 'ALL' || c.difficulty === diff));
  return (
    <Panel
      title="Desafios adicionais"
      subtitle={`${s.next.length} ainda não resolvidos · os da categoria mais fraca aparecem primeiro na sugestão`}
      right={
        <View style={{ flexDirection: 'row', gap: 8, zIndex: 10 }}>
          <Dropdown label="Categoria" value={cat} onChange={setCat} options={[{ value: 'ALL', label: 'Todas' }, ...CATEGORY_IDS.map((k) => ({ value: k, label: CATEGORY_LABEL[k] }))]} />
          <Dropdown label="Dificuldade" value={diff} onChange={setDiff} options={[{ value: 'ALL', label: 'Todas' }, ...DIFFICULTY_IDS.map((k) => ({ value: k, label: DIFFICULTY_LABEL[k] }))]} />
        </View>
      }>
      {s.next[0] ? (
        <Pressable onPress={() => onPick(s.next[0])} style={[styles.suggest, css({ cursor: 'pointer' })]} accessibilityRole="button" accessibilityLabel={`Sugestão: ${s.next[0].title}`}>
          <Ionicons name="sparkles" size={16} color={colors.gold} />
          <Text style={styles.suggestText}>
            Sugestão: <Text style={{ color: colors.text }}>{s.next[0].title}</Text> · {CATEGORY_LABEL[s.next[0].category]}
          </Text>
          <Ionicons name="arrow-forward" size={16} color={colors.accentSoft} />
        </Pressable>
      ) : null}
      <View style={styles.cards}>
        {list.map((c) => {
          const a = done.get(c.id);
          return (
            <Pressable key={c.id} onPress={() => onPick(c)} style={({ hovered }: WebPress) => [styles.card, hovered && { backgroundColor: colors.surfaceHigh }, css({ cursor: 'pointer' })]} accessibilityRole="button" accessibilityLabel={`Desafio ${c.title}`}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Tag text={CATEGORY_LABEL[c.category]} />
                <Tag text={DIFFICULTY_LABEL[c.difficulty]} color={c.difficulty === 'facil' ? colors.good : c.difficulty === 'medio' ? colors.gold : colors.loss} />
                <View style={{ flex: 1 }} />
                {a ? <Ionicons name={a.correct ? 'checkmark-circle' : 'close-circle'} size={16} color={a.correct ? colors.good : colors.loss} /> : null}
              </View>
              <Text style={styles.cardTitle}>{c.title}</Text>
              <Text style={styles.cardText} numberOfLines={2}>
                {c.context}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Panel>
  );
}

function Stats({ s }: { s: ChallengeState }) {
  const row = (label: string, r: { attempts: number; correct: number }) => (
    <View key={label} style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={{ flex: 1 }}>
        <MiniBar value={r.attempts ? r.correct / r.attempts : 0} max={1} color={r.attempts && r.correct / r.attempts >= 0.6 ? colors.good : colors.warning} />
      </View>
      <Text style={styles.statVal}>{r.attempts ? `${pct(r.correct / r.attempts)} · ${r.correct}/${r.attempts}` : 'sem respostas'}</Text>
    </View>
  );
  return (
    <Panel title="Estatísticas" subtitle="Aproveitamento por categoria e por dificuldade">
      <Text style={styles.group}>Categorias</Text>
      {CATEGORY_IDS.map((k) => row(CATEGORY_LABEL[k], s.byCategory[k]))}
      <Text style={[styles.group, { marginTop: 14 }]}>Dificuldade</Text>
      {DIFFICULTY_IDS.map((k) => row(DIFFICULTY_LABEL[k], s.byDifficulty[k]))}
    </Panel>
  );
}

function RankingPanel({ ch, xp }: { ch: ChallengeHook; xp: number }) {
  const [r, setR] = useState<Ranking | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => void ch.service?.ranking().then(setR).catch(() => setErr('Não foi possível carregar o ranking.'));
  useEffect(load, [ch.service, xp]);
  const cols: Column<Ranking['entries'][number]>[] = [
    { key: 'p', label: '#', width: 44, render: (e) => <T strong={e.you}>{String(e.position)}</T> },
    { key: 'u', label: 'Jogador', flex: 1, render: (e) => <T strong={e.you} color={e.you ? colors.accentSoft : undefined}>{e.username}</T> },
    { key: 'x', label: 'XP', width: 70, align: 'right', render: (e) => <T strong>{String(e.xp)}</T> },
    { key: 's', label: 'Acertos', width: 70, align: 'right', render: (e) => <T>{String(e.solved)}</T> },
  ];
  return (
    <Panel
      title="Ranking"
      subtitle={r?.demo ? 'Jogadores fictícios (demonstração)' : 'Só aparecem jogadores que aceitaram participar'}
      right={
        r && !r.demo ? (
          <Button
            kind={r.optedIn ? 'danger' : 'primary'}
            label={r.optedIn ? 'Sair do ranking' : 'Participar do ranking'}
            onPress={() => void ch.service?.setRanking(!r.optedIn).then(load)}
          />
        ) : undefined
      }>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {r ? (
        <>
          <DataTable columns={cols} rows={r.entries} rowKey={(e) => `${e.position}-${e.username}`} minWidth={300} empty="Ninguém no ranking ainda. Seja o primeiro." />
          {!r.demo && !r.optedIn ? <Text style={styles.note}>Ao participar, só o seu nome de usuário e o seu XP ficam visíveis para outros jogadores.</Text> : null}
        </>
      ) : null}
    </Panel>
  );
}

function History({ s }: { s: ChallengeState }) {
  const rows = useMemo(() => [...s.attempts].reverse(), [s.attempts]);
  return (
    <Panel title="Histórico" subtitle="Primeira resposta de cada desafio" padded={false}>
      <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
        <DataTable
          rows={rows}
          rowKey={(a) => `${a.day}-${a.challengeId}-${a.daily}`}
          minWidth={640}
          pageSize={10}
          columns={[
            { key: 'd', label: 'Dia', width: 100, render: (a) => <T>{a.day.split('-').reverse().join('/')}</T>, sort: (a) => a.at },
            { key: 'c', label: 'Desafio', flex: 2, render: (a) => <T strong>{challengeById(a.challengeId)?.title ?? a.challengeId}</T> },
            { key: 'k', label: 'Categoria', width: 140, render: (a) => <T>{CATEGORY_LABEL[challengeById(a.challengeId)?.category ?? 'lane']}</T> },
            { key: 't', label: 'Tipo', width: 90, render: (a) => <T muted>{a.daily ? 'Diário' : 'Extra'}</T> },
            { key: 'r', label: 'Resultado', width: 100, render: (a) => <T color={a.correct ? colors.good : colors.loss}>{a.correct ? 'Acertou' : 'Errou'}</T>, sort: (a) => (a.correct ? 1 : 0) },
            { key: 'x', label: 'XP', width: 60, align: 'right', render: (a) => <T>{`+${a.xp}`}</T>, sort: (a) => a.xp },
            { key: 'o', label: '', width: 70, render: (a) => (a.seeded ? <T muted>DEMO</T> : null) },
          ]}
        />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  err: { fontFamily: fonts.body, fontSize: 13, color: colors.loss, marginTop: 10 },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.goldDim },
  demoText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.gold },
  levelBar: { marginTop: -8 },
  week: { flexDirection: 'row' },
  weekDay: { flex: 1, textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textMuted, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  day: { flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  dayDaily: { backgroundColor: 'rgba(201,164,92,0.32)' },
  dayExtra: { backgroundColor: colors.accentDim },
  dayToday: { borderWidth: 1.5, borderColor: colors.accentSoft },
  dayText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textMuted },
  ach: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 4 },
  achTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text },
  achDetail: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, marginBottom: 14 },
  suggestText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flexGrow: 1, flexBasis: 260, maxWidth: 420, padding: 14, gap: 6, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  cardText: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.textMuted },
  group: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 6 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  statLabel: { width: 130, fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  statVal: { width: 120, textAlign: 'right', fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 8 },
});
