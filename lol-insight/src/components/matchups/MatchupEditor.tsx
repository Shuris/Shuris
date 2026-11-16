import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ChampionAvatar, haptic, Segmented, Sheet } from '@/components/ui';
import { champion } from '@/data/champions';
import type { MatchupsState } from '@/hooks/useMatchups';
import { DIFFICULTY_LABEL, NOTE_MAX_CHARS, type Difficulty } from '@/services/matchupNotes';
import { colors, fonts, radius, space, type } from '@/theme';

/** Painel para escrever a anotação de um confronto (seu campeão × adversário). */
export function MatchupEditor({
  matchups,
  championId,
  opponentId,
  record,
  onClose,
}: {
  matchups: MatchupsState;
  championId: string;
  opponentId: string | null;
  /** Retrospecto no confronto, ex.: "3V 2D". */
  record?: string;
  onClose: () => void;
}) {
  const existing = opponentId ? matchups.find(championId, opponentId) : undefined;
  const [difficulty, setDifficulty] = useState<Difficulty>('equilibrado');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDifficulty(existing?.difficulty ?? 'equilibrado');
    setNote(existing?.note ?? '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opponentId, championId]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      haptic.success();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  };

  const me = champion(championId);
  const opp = opponentId ? champion(opponentId) : null;
  return (
    <Sheet visible={!!opponentId} title="Anotação do confronto" onClose={onClose}>
      {opp ? (
        <View style={{ gap: space.md }}>
          <View style={styles.vs}>
            <ChampionAvatar id={me.id} size={40} />
            <Text style={styles.vsText}>×</Text>
            <ChampionAvatar id={opp.id} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>
                {me.name} contra {opp.name}
              </Text>
              {record ? <Text style={type.bodySm}>Seu retrospecto: {record}</Text> : null}
            </View>
          </View>
          <Text style={type.label}>Dificuldade</Text>
          <Segmented options={(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] }))} value={difficulty} onChange={setDifficulty} />
          <Text style={type.label}>O que lembrar</Text>
          <TextInput
            value={note}
            onChangeText={(t) => setNote(t.slice(0, NOTE_MAX_CHARS))}
            placeholder={`Ex.: contra ${opp.name}, guardar a habilidade de fuga para depois do combo dele.`}
            placeholderTextColor={colors.textMuted}
            multiline
            accessibilityLabel="Anotação"
            style={styles.input}
          />
          <Text style={[type.bodySm, { textAlign: 'right', fontSize: 11 }]}>
            {note.length}/{NOTE_MAX_CHARS} · {matchups.owner === 'demo' ? 'salvo só neste aparelho (demonstração)' : 'salvo na sua conta'}
          </Text>
          {error ? <Text style={[type.bodySm, { color: colors.loss }]}>{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {existing ? (
              <Pressable disabled={busy} onPress={() => run(() => matchups.remove(championId, opp.id))} style={[styles.btn, styles.ghost]} accessibilityRole="button" accessibilityLabel="Apagar anotação">
                <Text style={[styles.btnText, { color: colors.loss }]}>Apagar</Text>
              </Pressable>
            ) : null}
            <Pressable disabled={busy} onPress={() => run(() => matchups.save({ championId, opponentId: opp.id, difficulty, note }))} style={[styles.btn, { flex: 1 }]} accessibilityRole="button" accessibilityLabel="Salvar anotação">
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Salvar anotação</Text>}
            </Pressable>
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

export const DIFFICULTY_COLOR: Record<Difficulty, string> = { facil: colors.good, equilibrado: colors.gold, dificil: colors.loss };

const styles = StyleSheet.create({
  vs: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  vsText: { fontFamily: fonts.title, fontSize: 18, color: colors.gold },
  input: { minHeight: 110, maxHeight: 180, textAlignVertical: 'top', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md, color: colors.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  btn: { height: 44, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  ghost: { backgroundColor: colors.lossDim },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#fff' },
});
