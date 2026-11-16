import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { champion, championSplashUrl } from '@/data/champions';
import { colors } from '@/theme';

/**
 * Arte oficial do campeão (Data Dragon) como fundo, com degradê que escurece
 * até o tom do cartão. Sem rede, mostra um fundo desenhado na cor do campeão,
 * para o cartão nunca ficar "vazio".
 */
export function ChampionBackdrop({
  id,
  height = 170,
  children,
  style,
  tint,
  focus = 'top',
}: {
  id: string;
  height?: number;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Cor de realce sobreposta (ex.: azul na vitória, vermelho na derrota). */
  tint?: string;
  /** A arte é larga: "top" mostra o rosto do campeão na maioria das imagens. */
  focus?: 'top' | 'center';
}) {
  const c = champion(id);
  const [ok, setOk] = useState(true);
  return (
    <View style={[{ height, backgroundColor: c.color, overflow: 'hidden', justifyContent: 'flex-end' }, style]}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 200 100" preserveAspectRatio="xMidYMid slice" pointerEvents="none">
        <Circle cx="160" cy="18" r="58" fill="rgba(255,255,255,0.10)" />
        <Circle cx="160" cy="18" r="34" fill="rgba(255,255,255,0.08)" />
        <Path d="M0 70 Q60 40 120 64 T200 52 V100 H0 Z" fill="rgba(0,0,0,0.18)" />
      </Svg>
      {ok ? (
        <Image
          source={{ uri: championSplashUrl(c.id) }}
          onError={() => setOk(false)}
          style={focus === 'top' ? { position: 'absolute', left: 0, right: 0, top: 0, height: height * 1.35 } : StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {tint ? <LinearGradient colors={[tint, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 0.8 }} style={[StyleSheet.absoluteFill, { opacity: 0.35 }]} /> : null}
      <LinearGradient
        colors={['rgba(14,18,24,0.05)', 'rgba(14,18,24,0.55)', colors.surface]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}
