import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Meter, Segmented } from '@/components/ui';
import { describeError, MATCH_COUNTS } from '@/services';
import { usePlayer, type Derived } from '@/state/PlayerContext';
import { ago } from '@/stats/format';
import { colors, fonts, space, type } from '@/theme';

const COUNT_OPTIONS = MATCH_COUNTS.map((value) => ({ value, label: String(value) }));

/**
 * Situação dos dados exibidos. Na demonstração, avisa que são fictícios. Nos
 * dados reais, permite escolher quantas partidas analisar, mostra o progresso
 * da coleta (carregamento progressivo) e eventuais falhas da Riot.
 */
export function DataStatusCard({ data }: { data: Derived }) {
  const { settings, setMatchCount, refresh, refreshing } = usePlayer();

  if (data.source === 'demo') {
    return (
      <View style={styles.demo}>
        <Ionicons name="flask" size={14} color={colors.gold} />
        <Text style={[type.bodySm, { flex: 1 }]}>
          <Text style={{ color: colors.gold, fontFamily: fonts.bodyBold }}>Modo demonstração.</Text> Conta e partidas fictícias. Ative os dados reais em Perfil → Fonte de dados.
        </Text>
      </View>
    );
  }

  const sync = data.sync;
  const busy = sync?.state === 'syncing' || sync?.state === 'waiting_rate_limit';
  const ignored = (data.ignored?.otherModes ?? 0) + (data.ignored?.remakes ?? 0);
  const problem = sync?.state === 'error' ? describeError(sync.errorCode) : null;

  return (
    <Card>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={type.h3}>Partidas analisadas</Text>
          <Text style={type.bodySm}>
            {sync?.lastSyncedAt ? `Atualizado ${ago(sync.lastSyncedAt)}` : 'Ainda não sincronizado'} · Riot Games API
          </Text>
        </View>
        <Pressable
          onPress={refresh}
          disabled={busy || refreshing}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Atualizar dados"
          style={({ pressed }) => [styles.refresh, (busy || refreshing) && { opacity: 0.5 }, pressed && { opacity: 0.7 }]}>
          {busy || refreshing ? <ActivityIndicator size="small" color={colors.accentSoft} /> : <Ionicons name="refresh" size={17} color={colors.accentSoft} />}
        </Pressable>
      </View>

      <Segmented options={COUNT_OPTIONS} value={settings.matchCount} onChange={setMatchCount} />

      {busy && sync ? (
        <View style={styles.progress} accessibilityLiveRegion="polite">
          <Meter value={sync.available ? sync.loaded / sync.available : 0} color={colors.accent} height={5} />
          <Text style={type.bodySm}>
            {sync.state === 'waiting_rate_limit'
              ? `Limite de requisições da Riot atingido: retomando em ${sync.retryAfterSec ?? '…'} s (${sync.loaded} de ${sync.available} partidas).`
              : `Carregando partidas: ${sync.loaded} de ${sync.available}…`}
          </Text>
        </View>
      ) : null}

      {problem && sync ? (
        <View style={styles.problem}>
          <Ionicons name={problem.icon} size={15} color={colors.loss} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={[type.h3, { color: colors.loss }]}>{problem.title}</Text>
            <Text style={type.bodySm}>
              {sync.message} {sync.retryAfterSec ? `Tente de novo em ${sync.retryAfterSec} s. ` : ''}Exibindo as {data.matches.length} partidas já armazenadas.
            </Text>
          </View>
        </View>
      ) : null}

      {!busy ? (
        <Text style={[type.bodySm, { marginTop: space.md }]}>
          {data.matches.length} {data.matches.length === 1 ? 'partida' : 'partidas'} de Summoner's Rift nas últimas {sync?.available ?? settings.matchCount}
          {ignored
            ? ` · ${ignored} fora da análise (${[
                data.ignored?.otherModes ? `${data.ignored.otherModes} de outros modos` : '',
                data.ignored?.remakes ? `${data.ignored.remakes} ${data.ignored.remakes === 1 ? 'remake' : 'remakes'}` : '',
              ]
                .filter(Boolean)
                .join(', ')})`
            : ''}
          .
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: 'rgba(201,164,92,0.35)',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  refresh: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentDim },
  progress: { gap: 8, marginTop: space.md },
  problem: { flexDirection: 'row', gap: 10, marginTop: space.md, padding: 10, borderRadius: 10, backgroundColor: colors.lossDim },
});
