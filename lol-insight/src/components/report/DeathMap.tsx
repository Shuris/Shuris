import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';

import { champion } from '@/data/champions';
import { ZONE_LABEL, zoneOf } from '@/stats/matchReport';
import { colors, fonts, radius, space } from '@/theme';
import type { MatchAnalysis } from '@/types';

/**
 * Mapa estilizado do Summoner's Rift com as mortes (X vermelho) e os abates
 * (ponto azul) do jogador. Desenho próprio, sem a arte oficial do mapa.
 * Coordenadas 0–1, origem embaixo à esquerda (base azul).
 */
export function DeathMap({ analysis, size = 300 }: { analysis: MatchAnalysis; size?: number }) {
  const [sel, setSel] = useState<number | null>(null);
  const S = 100;
  const px = (v: number) => v * S;
  const py = (v: number) => (1 - v) * S;
  const d = sel !== null ? analysis.deaths[sel] : null;

  return (
    <View style={{ alignItems: 'center', gap: space.md }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="map-bg" x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0" stopColor="#0F1C24" />
              <Stop offset="0.5" stopColor="#101820" />
              <Stop offset="1" stopColor="#1E1418" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" rx="8" fill="url(#map-bg)" />
          {/* Rio */}
          <Path d="M12 12 Q30 40 50 50 T88 88" stroke="#17344A" strokeWidth="9" fill="none" strokeLinecap="round" opacity={0.85} />
          {/* Rotas */}
          <Path d="M10 88 L10 12 Q10 10 12 10 L88 10" stroke="#2A3340" strokeWidth="4.5" fill="none" strokeLinejoin="round" />
          <Path d="M12 90 L88 90 Q90 90 90 88 L90 12" stroke="#2A3340" strokeWidth="4.5" fill="none" strokeLinejoin="round" />
          <Line x1="14" y1="86" x2="86" y2="14" stroke="#2A3340" strokeWidth="4.5" />
          {/* Bases */}
          <Polygon points="2,98 2,80 8,80 20,92 20,98" fill="rgba(61,139,255,0.35)" />
          <Polygon points="98,2 98,20 92,20 80,8 80,2" fill="rgba(229,96,106,0.35)" />
          <Circle cx="8" cy="92" r="4" fill="#3D86FF" />
          <Circle cx="92" cy="8" r="4" fill="#E5606A" />
          {/* Abates */}
          {analysis.kills.map((k, i) => (
            <Circle key={`k${i}`} cx={px(k.x)} cy={py(k.y)} r={2.1} fill={colors.accentSoft} stroke="#0B1220" strokeWidth={0.6} />
          ))}
          {/* Mortes */}
          {analysis.deaths.map((p, i) => {
            const on = sel === i;
            const r = on ? 3.6 : 2.6;
            return (
              <G key={`d${i}`}>
                {on ? <Circle cx={px(p.x)} cy={py(p.y)} r={6} fill="rgba(229,96,106,0.25)" /> : null}
                <Line x1={px(p.x) - r} y1={py(p.y) - r} x2={px(p.x) + r} y2={py(p.y) + r} stroke={colors.loss} strokeWidth={1.6} strokeLinecap="round" />
                <Line x1={px(p.x) - r} y1={py(p.y) + r} x2={px(p.x) + r} y2={py(p.y) - r} stroke={colors.loss} strokeWidth={1.6} strokeLinecap="round" />
              </G>
            );
          })}
        </Svg>
        {/* Áreas de toque das mortes */}
        {analysis.deaths.map((p, i) => (
          <Pressable
            key={`t${i}`}
            onPress={() => setSel(sel === i ? null : i)}
            accessibilityRole="button"
            accessibilityLabel={`Morte aos ${Math.floor(p.minute)} minutos`}
            style={{ position: 'absolute', left: p.x * size - 14, top: (1 - p.y) * size - 14, width: 28, height: 28 }}
          />
        ))}
      </View>
      <View style={styles.readout}>
        {d ? (
          <Text style={styles.text}>
            <Text style={styles.strong}>{Math.floor(d.minute)} min</Text> · {ZONE_LABEL[zoneOf(d, analysis.playerTeam)]} ·{' '}
            {d.killerChampionId ? `abatido por ${champion(d.killerChampionId).name}` : 'executado'}
            {d.enemiesInvolved > 1 ? ` com ${d.enemiesInvolved - 1} ${d.enemiesInvolved === 2 ? 'ajudante' : 'ajudantes'}` : ' sozinho'}
          </Text>
        ) : (
          <Text style={styles.text}>Toque em um X para ver como foi a morte.</Text>
        )}
      </View>
      <View style={styles.legend}>
        <Text style={[styles.legendItem, { color: colors.loss }]}>✕ Mortes ({analysis.deaths.length})</Text>
        <Text style={[styles.legendItem, { color: colors.accentSoft }]}>● Abates ({analysis.kills.length})</Text>
        <Text style={styles.legendItem}>Sua base: {analysis.playerTeam === 'BLUE' ? 'embaixo, à esquerda' : 'em cima, à direita'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { alignSelf: 'stretch', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 12 },
  text: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary },
  strong: { fontFamily: fonts.bodyBold, color: colors.text },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'center' },
  legendItem: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: colors.textMuted },
});
