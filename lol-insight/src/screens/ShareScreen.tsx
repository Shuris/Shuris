import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type Svg from 'react-native-svg';

import { ShareCard, type ShareCardData } from '@/components/share/ShareCard';
import { Card, EmptyState, haptic, Screen, Segmented } from '@/components/ui';
import { CONTENT_MAX_WIDTH } from '@/components/ui/Screen';
import { shareSvgAsPng } from '@/services/shareImage';
import { usePlayer } from '@/state/PlayerContext';
import { byChampion, summarize, withinDays } from '@/stats/aggregate';
import { colors, fonts, radius, space, type } from '@/theme';

type Period = 7 | 30 | 0;

/** Cartão para compartilhar: resumo da semana, do mês ou de todas as partidas carregadas. */
export function ShareScreen() {
  const { data } = usePlayer();
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState<Period>(7);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const svgRef = useRef<Svg>(null);
  const boxRef = useRef<React.ComponentRef<typeof View>>(null);

  const card: ShareCardData | null = useMemo(() => {
    if (!data) return null;
    const list = period ? withinDays(data.matches, data.asOf, period) : data.matches;
    const s = summarize(list);
    const champs = byChampion(list).sort((a, b) => b.games - a.games);
    const lp = list.reduce((t, m) => t + (m.lpDelta ?? 0), 0);
    return {
      name: data.player.gameName,
      tag: data.player.tagLine,
      region: data.player.region,
      rank: data.player.rank,
      period: period === 7 ? 'Últimos 7 dias' : period === 30 ? 'Últimos 30 dias' : `Últimas ${data.matches.length} partidas`,
      games: s.games,
      winRate: s.winRate,
      kda: s.kda,
      csPerMin: s.csPerMin,
      champions: champs.slice(0, 3).map((c) => ({ id: c.championId, games: c.games, winRate: c.winRate })),
      identity: data.identity.primary?.title,
      lpChange: list.some((m) => m.lpDelta !== undefined) ? lp : undefined,
      demo: data.source === 'demo',
    };
  }, [data, period]);

  if (!data || !card) {
    return (
      <Screen title="Compartilhar" back>
        <Card>
          <EmptyState icon="share-social-outline" title="Nada para compartilhar ainda" message="Carregue um perfil na Início para gerar o cartão." />
        </Card>
      </Screen>
    );
  }

  const cardWidth = Math.min(width, CONTENT_MAX_WIDTH) - space.lg * 2;
  const share = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const how = await shareSvgAsPng(svgRef.current, boxRef.current as unknown, `lol-insight-${card.name.toLowerCase()}-${period || 'todas'}`);
      haptic.success();
      setMsg({ ok: true, text: how === 'downloaded' ? 'Imagem baixada (1080 × 1350).' : 'Pronto!' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Não foi possível gerar a imagem.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Cartão para compartilhar" subtitle="Imagem 1080 × 1350, no formato de post" back>
      <Segmented
        options={[
          { value: 7, label: 'Semana' },
          { value: 30, label: 'Mês' },
          { value: 0, label: 'Todas' },
        ]}
        value={period}
        onChange={(v) => setPeriod(v as Period)}
      />
      <View ref={boxRef} style={styles.frame} accessibilityLabel={`Cartão: ${card.name}, ${card.period}`}>
        <ShareCard ref={svgRef} data={card} width={cardWidth} />
      </View>
      {card.games === 0 ? <Text style={[type.bodySm, { textAlign: 'center' }]}>Sem partidas neste período: escolha um período maior.</Text> : null}
      <Pressable onPress={share} disabled={busy || card.games === 0} style={({ pressed }) => [styles.btn, (pressed || busy) && { opacity: 0.8 }, card.games === 0 && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Compartilhar imagem">
        {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name={Platform.OS === 'web' ? 'download-outline' : 'share-social'} size={18} color="#fff" />}
        <Text style={styles.btnText}>{Platform.OS === 'web' ? 'Baixar ou compartilhar imagem' : 'Compartilhar imagem'}</Text>
      </Pressable>
      {msg ? <Text style={[type.bodySm, { textAlign: 'center', color: msg.ok ? colors.good : colors.loss }]}>{msg.text}</Text> : null}
      <Text style={[type.bodySm, { textAlign: 'center' }]}>
        O cartão mostra só o seu Riot ID, o elo e números das partidas. {card.demo ? 'No modo demonstração ele leva a marca "dados demonstrativos".' : ''}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.lg, overflow: 'hidden', alignSelf: 'center', backgroundColor: colors.bg },
  btn: { height: 48, borderRadius: radius.md, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#fff' },
});
