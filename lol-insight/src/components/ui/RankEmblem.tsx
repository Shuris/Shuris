import React from 'react';
import Svg, { Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { tierLabel } from '@/stats/rank';
import type { Rank, Tier } from '@/types';

import { emblemParts, TIER_PALETTE, type EmblemFill, type EmblemPart } from './emblemShapes';

/** Emblema de elo desenhado em vetor (brasão, gema e asas que crescem com a liga). */
export function RankEmblem({ rank, tier, size = 44 }: { rank?: Rank; tier?: Tier; size?: number }) {
  const t = tier ?? rank?.tier ?? 'FERRO';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel={`Emblema ${tierLabel(t)}`}>
      <EmblemGraphic tier={t} />
    </Svg>
  );
}

/** O desenho do emblema (coordenadas 0–100), para usar dentro de outro SVG — ex.: o cartão de compartilhamento. */
export function EmblemGraphic({ tier: t, transform }: { tier: Tier; transform?: string }) {
  const pal = TIER_PALETTE[t];
  const id = `emb-${t}`;
  const fill: Record<EmblemFill, string> = {
    metal: `url(#${id}-m)`,
    metalDeep: `url(#${id}-d)`,
    edge: `url(#${id}-e)`,
    gem: `url(#${id}-g)`,
    facet: pal.glow,
    shine: '#FFFFFF',
    halo: pal.gem,
  };
  const paint = (p: EmblemPart) =>
    p.stroke
      ? { fill: 'none', stroke: fill[p.fill], strokeWidth: p.stroke, strokeLinejoin: 'round' as const, opacity: p.opacity ?? 1 }
      : { fill: fill[p.fill], opacity: p.opacity ?? 1 };
  return (
    <G transform={transform}>
      <Defs>
        <LinearGradient id={`${id}-m`} x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={pal.light} />
          <Stop offset="0.55" stopColor={pal.light} stopOpacity={0.85} />
          <Stop offset="1" stopColor={pal.dark} />
        </LinearGradient>
        <LinearGradient id={`${id}-d`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={pal.light} stopOpacity={0.75} />
          <Stop offset="1" stopColor={pal.dark} />
        </LinearGradient>
        <LinearGradient id={`${id}-e`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={pal.dark} />
          <Stop offset="1" stopColor="#07090D" />
        </LinearGradient>
        <RadialGradient id={`${id}-g`} cx="0.5" cy="0.4" r="0.7">
          <Stop offset="0" stopColor={pal.glow} />
          <Stop offset="0.45" stopColor={pal.gem} />
          <Stop offset="1" stopColor={pal.dark} />
        </RadialGradient>
      </Defs>
      {emblemParts(t).map((p, i) => (
        <G key={i}>
          <Path d={p.d} {...paint(p)} />
          {p.mirror ? <Path d={p.d} {...paint(p)} transform="translate(100 0) scale(-1 1)" /> : null}
        </G>
      ))}
    </G>
  );
}
