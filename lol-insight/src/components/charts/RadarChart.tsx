import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';

import { colors, fonts } from '@/theme';

interface RadarProps {
  axes: Array<{ key: string; label: string; value: number }>;
  selected?: string;
  onSelect?: (key: string) => void;
  size?: number;
}

/** Radar de 0–100 com rótulos tocáveis. */
export function RadarChart({ axes, selected, onSelect, size = 250 }: RadarProps) {
  const [w, setW] = useState(0);
  const s = Math.min(size, w || size);
  const cx = s / 2;
  const cy = s / 2;
  const r = s / 2 - 46;
  const angle = (i: number) => (Math.PI * 2 * i) / axes.length - Math.PI / 2;
  const pt = (i: number, v: number) => ({ x: cx + Math.cos(angle(i)) * r * v, y: cy + Math.sin(angle(i)) * r * v });
  // Piso visual: notas muito baixas ainda formam um polígono legível em vez de colapsar no centro.
  const shown = (value: number) => Math.max(8, value) / 100;
  const poly = (v: (i: number) => number) => axes.map((_, i) => pt(i, v(i))).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ alignItems: 'center' }}>
      <View style={{ width: s, height: s }}>
        <Svg width={s} height={s}>
          {[0.25, 0.5, 0.75, 1].map((lvl) => (
            <Polygon key={lvl} points={poly(() => lvl)} fill="none" stroke={lvl === 0.5 ? 'rgba(201,164,92,0.45)' : colors.grid} strokeWidth={1} />
          ))}
          {axes.map((_, i) => {
            const p = pt(i, 1);
            return <Line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={colors.grid} strokeWidth={1} />;
          })}
          <Polygon points={poly((i) => shown(axes[i].value))} fill="rgba(47,125,255,0.22)" stroke={colors.accentSoft} strokeWidth={2} strokeLinejoin="round" />
          {axes.map((a, i) => {
            const p = pt(i, shown(a.value));
            const on = a.key === selected;
            return <Circle key={a.key} cx={p.x} cy={p.y} r={on ? 5.5 : 3.5} fill={on ? colors.gold : colors.accentSoft} stroke={colors.surface} strokeWidth={2} />;
          })}
        </Svg>
        {axes.map((a, i) => {
          const p = pt(i, 1.0);
          const lx = cx + Math.cos(angle(i)) * (r + 26);
          const ly = cy + Math.sin(angle(i)) * (r + 20);
          const on = a.key === selected;
          return (
            <Text
              key={a.key}
              onPress={() => onSelect?.(a.key)}
              accessibilityRole="button"
              accessibilityLabel={`${a.label}: ${a.value} de 100`}
              suppressHighlighting
              style={[styles.label, { left: lx - 44, top: ly - 15 }, on && { color: colors.text }]}>
              {a.label}
              {'\n'}
              <Text style={[styles.value, on && { color: colors.gold }]}>{a.value}</Text>
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { position: 'absolute', width: 88, textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 10.5, lineHeight: 14, color: colors.textMuted },
  value: { fontFamily: fonts.display, fontSize: 13.5, color: colors.textSecondary },
});
