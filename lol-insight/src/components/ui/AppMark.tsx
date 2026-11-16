import React from 'react';
import Svg, { Defs, LinearGradient, Path, Polygon, Stop } from 'react-native-svg';

const hex = (r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

/** Marca do LOL Insight (a mesma do ícone do app): gema hextech num hexágono dourado. */
export function AppMark({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="LOL Insight">
      <Defs>
        <LinearGradient id="mark-gold" x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor="#FCE7AE" />
          <Stop offset="0.5" stopColor="#D9AE5C" />
          <Stop offset="1" stopColor="#7C5219" />
        </LinearGradient>
        <LinearGradient id="mark-gem" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#BFD7FF" />
          <Stop offset="0.45" stopColor="#3D86FF" />
          <Stop offset="1" stopColor="#132C66" />
        </LinearGradient>
      </Defs>
      <Polygon points={hex(42)} fill="#0B1220" stroke="url(#mark-gold)" strokeWidth={8} strokeLinejoin="round" />
      <Path d="M50 24 L65 50 L50 77 L35 50 Z" fill="url(#mark-gem)" />
      <Path d="M50 27 L54 49 L50 53 L46 49 Z" fill="#FFFFFF" opacity={0.7} />
    </Svg>
  );
}

/** Selo hexagonal usado nos estados vazios e de erro: mesma linguagem visual da marca. */
export function HexBadge({ children, size = 64, color = '#5C9BFF' }: { children?: React.ReactNode; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Polygon points={hex(46)} fill={color} opacity={0.08} />
      <Polygon points={hex(40)} fill="#0E1218" stroke="#C9A45C" strokeOpacity={0.55} strokeWidth={3} strokeLinejoin="round" />
      <Polygon points={hex(33)} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={1.5} strokeLinejoin="round" />
      {children}
    </Svg>
  );
}
