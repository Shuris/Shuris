import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthPrompt } from '@/components/auth/AccountCard';
import { champion } from '@/data/champions';
import { lessonById } from '@/coach/lessons';
import { useMatchAnalysis } from '@/hooks/useMatchAnalysis';
import { decisionMoments, didacticMoments, type DecisionMoment, type ReplayAnalysisRecord } from '@/replay/decisions';
import { parseRofl, RoflError, type RoflMetadata } from '@/replay/rofl';
import { LocalReplayHistory, RemoteReplayHistory } from '@/services/replayHistory';
import { useAuth } from '@/state/AuthContext';
import { usePlayer, type Derived } from '@/state/PlayerContext';
import { dateTime, duration, int, pct, relativeDay } from '@/stats/format';
import { colors, fonts, radius } from '@/theme';
import type { Match } from '@/types';

import { Button, ChampCell, css, DataGate, DataTable, Dropdown, Page, Panel, Split, T, Tag } from './kit';

/** Replay Challenge: leitura real dos metadados do .rofl e desafios de decisão com eventos reais das partidas. */
export function WebReplay() {
  const { settings } = usePlayer();
  const auth = useAuth();
  const demo = settings.mode === 'demo';
  const store = useMemo(() => (demo ? new LocalReplayHistory() : auth.status === 'signedIn' ? new RemoteReplayHistory() : null), [demo, auth.status]);
  const [history, setHistory] = useState<ReplayAnalysisRecord[]>([]);
  const reload = () => void store?.list().then(setHistory).catch(() => setHistory([]));
  useEffect(reload, [store]);
  return (
    <Page eyebrow="Replay Challenge" title="Análise de decisões" subtitle="Reviva momentos reais das suas partidas e compare a sua escolha com o que aconteceu">
      <RoflImport />
      {!store ? (
        <AuthPrompt />
      ) : (
        <DataGate>
          {(d) => (
            <>
              <Decisions data={d} onSaved={(r) => (void store.save(r).then(reload))} />
              <History data={d} history={history} />
            </>
          )}
        </DataGate>
      )}
    </Page>
  );
}

function RoflImport() {
  const { data } = usePlayer();
  const router = useRouter();
  const [meta, setMeta] = useState<RoflMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const pick = () => {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.rofl';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      setName(f.name);
      setError(null);
      setMeta(null);
      try {
        setMeta(parseRofl(await f.arrayBuffer()));
      } catch (e) {
        setError(e instanceof RoflError ? e.message : 'Não foi possível ler o arquivo.');
      }
    };
    input.click();
  };
  // Procura a mesma partida entre as carregadas: mesmo campeão e mesmo K/D/A do jogador.
  const linked: Match | undefined = useMemo(() => {
    if (!meta || !data) return undefined;
    return data.matches.find((m) => Math.abs(m.durationSec - meta.gameLengthSec) <= 5 && meta.players.some((p) => p.champion === m.championId && p.kills === m.kills && p.deaths === m.deaths && p.assists === m.assists));
  }, [meta, data]);
  return (
    <Split>
      <Panel title="Importar replay (.rofl)" subtitle="O arquivo é lido no seu navegador e não é enviado a nenhum servidor" info="Os replays ficam em Documentos > League of Legends > Replays no seu computador.">
        <Pressable onPress={pick} style={[styles.drop, css({ cursor: 'pointer' })]} accessibilityRole="button" accessibilityLabel="Escolher arquivo de replay">
          <Ionicons name="cloud-upload-outline" size={28} color={colors.accentSoft} />
          <Text style={styles.dropTitle}>{name || 'Escolher arquivo .rofl'}</Text>
          <Text style={styles.dropText}>Lemos os metadados: duração, versão e as estatísticas finais dos 10 jogadores.</Text>
        </Pressable>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {meta ? (
          <View style={{ gap: 10, marginTop: 14 }}>
            <Text style={styles.meta}>
              Versão {meta.gameVersion} · {duration(meta.gameLengthSec)} · {meta.players.length} jogadores · {int(meta.size / 1024)} KB
            </Text>
            {linked ? <Button icon="link" label="Esta partida está no seu histórico: abrir a análise" onPress={() => router.push({ pathname: '/partida/[id]', params: { id: linked.id } })} /> : null}
            <DataTable
              minWidth={560}
              rows={meta.players}
              rowKey={(p) => `${p.team}-${p.name}-${p.champion}`}
              columns={[
                { key: 'n', label: 'Jogador', flex: 2, render: (p) => <T strong color={p.team === 'BLUE' ? colors.accentSoft : colors.loss}>{p.name}</T> },
                { key: 'c', label: 'Campeão', flex: 1, render: (p) => <T>{p.champion}</T> },
                { key: 'k', label: 'K/D/A', width: 90, align: 'right', render: (p) => <T mono>{`${p.kills}/${p.deaths}/${p.assists}`}</T> },
                { key: 'cs', label: 'CS', width: 56, align: 'right', render: (p) => <T>{String(p.cs)}</T> },
                { key: 'd', label: 'Dano', width: 80, align: 'right', render: (p) => <T>{int(p.damage)}</T> },
                { key: 'w', label: '', width: 70, render: (p) => <T color={p.win ? colors.good : colors.textMuted}>{p.win ? 'Vitória' : ''}</T> },
              ]}
            />
          </View>
        ) : null}
      </Panel>
      <Panel title="Momentos e pausas do replay" subtitle="Em preparação">
        <View style={{ gap: 10 }}>
          <Tag text="AINDA NÃO DISPONÍVEL" color={colors.warning} />
          <Text style={styles.body}>
            Ver posições, pausar o replay em situações específicas e fazer perguntas sobre aquele instante exigem decodificar o conteúdo da partida dentro do arquivo. Esse conteúdo é criptografado, muda a cada patch e não tem documentação oficial da Riot.
          </Text>
          <Text style={styles.body}>
            Por isso o LOL Insight não simula essa leitura. Enquanto ela não existe, os desafios abaixo usam os eventos reais da linha do tempo da partida (mortes, posições e objetivos informados pela Match-V5).
          </Text>
        </View>
      </Panel>
    </Split>
  );
}

function Decisions({ data, onSaved }: { data: Derived; onSaved: (r: Omit<ReplayAnalysisRecord, 'at' | 'score'>) => void }) {
  const recent = data.matches.slice(0, 20);
  const [matchId, setMatchId] = useState(recent[0]?.id ?? '');
  const match = recent.find((m) => m.id === matchId) ?? recent[0];
  return (
    <Panel
      title="Desafios de decisão"
      subtitle="Momentos tirados da linha do tempo real da partida escolhida"
      right={
        <Dropdown
          label="Partida"
          value={matchId}
          onChange={setMatchId}
          width={320}
          options={recent.map((m) => ({ value: m.id, label: `${champion(m.championId).name} · ${m.win ? 'V' : 'D'} ${m.kills}/${m.deaths}/${m.assists} · ${relativeDay(m.timestamp, data.asOf)}` }))}
        />
      }>
      {match ? <Session key={match.id} match={match} onSaved={onSaved} /> : null}
    </Panel>
  );
}

function Session({ match, onSaved }: { match: Match; onSaved: (r: Omit<ReplayAnalysisRecord, 'at' | 'score'>) => void }) {
  const a = useMatchAnalysis(match);
  const moments = useMemo(() => {
    if (a.status === 'loading') return null;
    const real = decisionMoments(match, a.status === 'ready' ? a.analysis : null);
    return real.length ? real : didacticMoments();
  }, [a, match]);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);
  if (!moments) return <Text style={styles.body}>Carregando a linha do tempo…</Text>;
  const done = Object.keys(answers).length === moments.length;
  const correct = moments.filter((m) => answers[m.id] === m.answer).length;
  const cur = moments[Math.min(i, moments.length - 1)];
  const finish = () => {
    if (saved) return;
    setSaved(true);
    if (moments[0].real) onSaved({ matchId: match.id, championId: match.championId, answers: moments.map((m) => ({ momentId: m.id, correct: answers[m.id] === m.answer })) });
  };
  return (
    <View style={{ gap: 14 }}>
      {!moments[0].real ? <Text style={styles.note}>Esta partida não tem momentos claros na linha do tempo (ou ela não está disponível). Abaixo, cenários didáticos que não correspondem à partida.</Text> : null}
      <View style={styles.steps}>
        {moments.map((m, k) => (
          <Pressable key={m.id} onPress={() => setI(k)} style={[styles.step, k === i && styles.stepOn, answers[m.id] !== undefined && { borderColor: answers[m.id] === m.answer ? colors.good : colors.loss }, css({ cursor: 'pointer' })]} accessibilityRole="tab" accessibilityLabel={m.title}>
            <Text style={styles.stepText}>{m.real ? `${Math.floor(m.minute)} min` : `Cenário ${k + 1}`}</Text>
          </Pressable>
        ))}
      </View>
      <Moment m={cur} answer={answers[cur.id]} onAnswer={(v) => setAnswers((x) => ({ ...x, [cur.id]: v }))} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {i < moments.length - 1 ? <Button label="Próximo momento" icon="arrow-forward" disabled={answers[cur.id] === undefined} onPress={() => setI(i + 1)} /> : null}
        {done ? <Button kind={saved ? 'ghost' : 'primary'} icon="save-outline" label={saved ? `Avaliação salva: ${correct}/${moments.length}` : `Concluir avaliação (${correct}/${moments.length})`} onPress={finish} /> : null}
      </View>
    </View>
  );
}

function Moment({ m, answer, onAnswer }: { m: DecisionMoment; answer?: number; onAnswer: (v: number) => void }) {
  const router = useRouter();
  const lesson = m.lessonId ? lessonById(m.lessonId) : undefined;
  const answered = answer !== undefined;
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.momentTitle}>{m.title}</Text>
      <Text style={styles.situation}>{m.situation}</Text>
      <Text style={styles.question}>{m.question}</Text>
      {m.options.map((o, k) => {
        const right = answered && k === m.answer;
        const wrong = answered && k === answer && answer !== m.answer;
        return (
          <Pressable key={k} disabled={answered} onPress={() => onAnswer(k)} style={[styles.opt, right && styles.optRight, wrong && styles.optWrong, css({ cursor: answered ? 'default' : 'pointer' })]} accessibilityRole="radio" accessibilityState={{ checked: answer === k }} accessibilityLabel={o}>
            <Text style={[styles.optText, right && { color: colors.text }]}>
              {String.fromCharCode(65 + k)}. {o}
            </Text>
          </Pressable>
        );
      })}
      {answered ? (
        <Split ratio={1}>
          <View style={styles.box}>
            <Text style={styles.boxTitle}>Por quê</Text>
            <Text style={styles.body}>{m.explanation}</Text>
            {lesson ? (
              <Text style={styles.link} onPress={() => router.push({ pathname: '/academy/aula/[id]', params: { id: lesson.id } })}>
                Aula: {lesson.title}
              </Text>
            ) : null}
          </View>
          <View style={[styles.box, { borderColor: 'rgba(201,164,92,0.35)' }]}>
            <Text style={[styles.boxTitle, { color: colors.gold }]}>{m.real ? 'O que aconteceu na partida' : 'Cenário didático'}</Text>
            <Text style={styles.body}>{m.happened}</Text>
          </View>
        </Split>
      ) : null}
    </View>
  );
}

function History({ data, history }: { data: Derived; history: ReplayAnalysisRecord[] }) {
  const router = useRouter();
  return (
    <Panel title="Histórico de análises" subtitle={history.length ? `${history.length} partidas avaliadas · média ${pct(history.reduce((t, h) => t + h.score, 0) / history.length)}` : 'As avaliações concluídas aparecem aqui'} padded={false}>
      <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
        <DataTable
          rows={history}
          rowKey={(h) => h.matchId}
          minWidth={520}
          empty="Nenhuma avaliação concluída ainda."
          onRowPress={(h) => (data.matches.some((m) => m.id === h.matchId) ? router.push({ pathname: '/partida/[id]', params: { id: h.matchId } }) : undefined)}
          columns={[
            { key: 'c', label: 'Partida', flex: 2, render: (h) => <ChampCell id={h.championId} sub={h.matchId} size={26} /> },
            { key: 'd', label: 'Avaliada em', width: 150, render: (h) => <T muted>{dateTime(h.at)}</T>, sort: (h) => h.at },
            { key: 's', label: 'Decisões certas', width: 140, align: 'right', render: (h) => <T strong color={h.score >= 0.5 ? colors.good : colors.loss}>{`${h.answers.filter((a) => a.correct).length}/${h.answers.length} (${pct(h.score)})`}</T>, sort: (h) => h.score },
          ]}
        />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  drop: { alignItems: 'center', gap: 6, padding: 24, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  dropTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  dropText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, textAlign: 'center' },
  err: { fontFamily: fonts.body, fontSize: 13, color: colors.loss, marginTop: 10 },
  meta: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textSecondary },
  body: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary },
  note: { fontFamily: fonts.body, fontSize: 12.5, color: colors.warning },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  step: { paddingHorizontal: 12, height: 32, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: 'transparent' },
  stepOn: { backgroundColor: colors.accentDim },
  stepText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.text },
  momentTitle: { fontFamily: fonts.title, fontSize: 20, color: colors.text },
  situation: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.textSecondary, backgroundColor: colors.surfaceAlt, padding: 12, borderRadius: radius.md },
  question: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.text },
  opt: { padding: 12, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: 'transparent' },
  optRight: { borderColor: 'rgba(47,179,128,0.6)', backgroundColor: 'rgba(47,179,128,0.12)' },
  optWrong: { borderColor: 'rgba(229,96,106,0.6)', backgroundColor: colors.lossDim },
  optText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textSecondary },
  box: { gap: 6, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  boxTitle: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.accentSoft },
  link: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.accentSoft, marginTop: 4 },
});
