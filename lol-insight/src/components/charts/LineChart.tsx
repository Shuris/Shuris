import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import type { SeriesPoint } from '@/stats/timeseries';
import { colors, fonts } from '@/theme';

import { Legend, Readout } from './Readout';

interface LineChartProps {
  points: SeriesPoint[];
  yFormat: (v: number) => string;
  color?: string;
  height?: number;
  area?: boolean;
  /** Nome da série principal (legenda). */
  label?: string;
  /** Segunda linha na mesma escala (ex.: média móvel). */
  overlay?: { values: number[]; label: string; color?: string };
  /** Linha de referência horizontal (ex.: média geral). */
  reference?: { y: number; label: string };
  /** Limites mínimos do eixo Y; o domínio se expande para caber nos dados. */
  yDomain?: [number, number];
  /** Colore os pontos por vitória/derrota. */
  resultDots?: boolean;
  emptyMessage?: string;
}

const PAD = { top: 10, bottom: 22, left: 38, right: 10 };

/** Curva cúbica monotônica: suave, sem ultrapassar os valores reais. */
function smoothPath(pts: Array<{ x: number; y: number }>): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    slope.push((pts[i + 1].y - pts[i].y) / (dx[i] || 1));
  }
  const m: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) m.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  m.push(slope[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const h = Math.hypot(a, b);
    if (h > 3) {
      m[i] = (3 * a * slope[i]) / h;
      m[i + 1] = (3 * b * slope[i]) / h;
    }
  }
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = pts[i].x + dx[i] / 3;
    const c1y = pts[i].y + (m[i] * dx[i]) / 3;
    const c2x = pts[i + 1].x - dx[i] / 3;
    const c2y = pts[i + 1].y - (m[i + 1] * dx[i]) / 3;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${pts[i + 1].x.toFixed(1)},${pts[i + 1].y.toFixed(1)}`;
  }
  return d;
}

let gradientSeq = 0;

export function LineChart({
  points,
  yFormat,
  color = colors.series1,
  height = 190,
  area = true,
  label,
  overlay,
  reference,
  yDomain,
  resultDots,
  emptyMessage = 'Sem partidas no período selecionado.',
}: LineChartProps) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const reveal = useRef(new Animated.Value(0)).current;
  const gradId = useRef(`lc-grad-${++gradientSeq}`).current;

  // Assinatura dos dados: quando muda (filtro aplicado), reinicia seleção e animação.
  const signature = `${points.length}:${points[0]?.title}:${points[points.length - 1]?.title}:${points[points.length - 1]?.y}`;
  useEffect(() => {
    setSelected(null);
    reveal.setValue(0);
    Animated.timing(reveal, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [signature, reveal]);

  const geo = useMemo(() => {
    const plotW = Math.max(0, width - PAD.left - PAD.right);
    const plotH = height - PAD.top - PAD.bottom;
    const values = [...points.map((p) => p.y), ...(overlay?.values ?? []), ...(reference ? [reference.y] : [])];
    let min = Math.min(...values, yDomain ? yDomain[0] : Infinity);
    let max = Math.max(...values, yDomain ? yDomain[1] : -Infinity);
    if (!isFinite(min) || !isFinite(max)) {
      min = 0;
      max = 1;
    }
    if (max - min < 1e-6) {
      max += 1;
      min -= 1;
    }
    if (!yDomain) {
      const pad = (max - min) * 0.12;
      min -= pad;
      max += pad;
    }
    const x = (i: number) => PAD.left + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const y = (v: number) => PAD.top + plotH - ((v - min) / (max - min)) * plotH;
    const xy = points.map((p, i) => ({ x: x(i), y: y(p.y) }));
    const line = smoothPath(xy);
    const base = PAD.top + plotH;
    const areaPath = xy.length > 1 ? `${line} L${xy[xy.length - 1].x.toFixed(1)},${base} L${xy[0].x.toFixed(1)},${base} Z` : '';
    const overlayPath = overlay ? smoothPath(overlay.values.map((v, i) => ({ x: x(i), y: y(v) }))) : '';
    const ticks = [max, (max + min) / 2, min].map((v) => ({ v, y: y(v) }));
    return { plotW, plotH, x, y, xy, line, areaPath, overlayPath, ticks, base };
  }, [points, overlay, reference, yDomain, width, height]);

  if (!points.length) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  const active = selected ?? points.length - 1;
  const point = points[Math.min(active, points.length - 1)];
  const pos = geo.xy[Math.min(active, geo.xy.length - 1)];

  const pick = (e: GestureResponderEvent) => {
    if (points.length < 2 || geo.plotW <= 0) return;
    const ratio = (e.nativeEvent.locationX - PAD.left) / geo.plotW;
    setSelected(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
  };

  const xLabels = points.length <= 1 ? [0] : points.length < 5 ? [0, points.length - 1] : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const showDots = points.length <= 70;
  const dotColor = (p: SeriesPoint) => (resultDots && p.win !== undefined ? (p.win ? colors.win : colors.loss) : color);

  return (
    <View>
      <Readout
        title={point.title}
        detail={point.detail}
        hint={selected === null ? 'Toque no gráfico' : undefined}
        color={dotColor(point)}
      />
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <>
            {/* Grade e eixos (estáticos) */}
            <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
              {geo.ticks.map((t, i) => (
                <Line key={i} x1={PAD.left} x2={width - PAD.right} y1={t.y} y2={t.y} stroke={colors.grid} strokeWidth={1} />
              ))}
              {reference ? (
                <Line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={geo.y(reference.y)}
                  y2={geo.y(reference.y)}
                  stroke={colors.gold}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  opacity={0.9}
                />
              ) : null}
            </Svg>
            {geo.ticks.map((t, i) => (
              <Text key={i} style={[styles.yTick, { top: t.y - 7 }]} numberOfLines={1}>
                {yFormat(t.v)}
              </Text>
            ))}
            {xLabels.map((idx, i) => (
              <Text
                key={idx}
                numberOfLines={1}
                style={[
                  styles.xTick,
                  i === 0 ? { left: PAD.left } : i === xLabels.length - 1 ? { right: PAD.right, textAlign: 'right' } : { left: geo.xy[idx].x - 40, width: 80, textAlign: 'center' },
                ]}>
                {points[idx].xLabel}
              </Text>
            ))}

            {/* Série: revelada da esquerda para a direita */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height,
                overflow: 'hidden',
                width: reveal.interpolate({ inputRange: [0, 1], outputRange: [PAD.left, width] }),
              }}>
              <Svg width={width} height={height}>
                <Defs>
                  <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={color} stopOpacity={0.28} />
                    <Stop offset="1" stopColor={color} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                {area && geo.areaPath ? <Path d={geo.areaPath} fill={`url(#${gradId})`} /> : null}
                {geo.overlayPath ? (
                  <Path d={geo.overlayPath} stroke={overlay?.color ?? colors.series2} strokeWidth={2} fill="none" strokeLinecap="round" />
                ) : null}
                <Path d={geo.line} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={resultDots ? 0.55 : 1} />
                {showDots && (resultDots || points.length <= 24)
                  ? geo.xy.map((p, i) => (
                      <Circle key={i} cx={p.x} cy={p.y} r={resultDots ? 3 : 2.5} fill={dotColor(points[i])} stroke={colors.surface} strokeWidth={1} />
                    ))
                  : null}
              </Svg>
            </Animated.View>

            {/* Cursor do ponto selecionado */}
            <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
              {selected !== null ? (
                <Line x1={pos.x} x2={pos.x} y1={PAD.top} y2={geo.base} stroke="rgba(255,255,255,0.28)" strokeWidth={1} />
              ) : null}
              <Circle cx={pos.x} cy={pos.y} r={5.5} fill={dotColor(point)} stroke={colors.surface} strokeWidth={2} />
            </Svg>

            <View
              style={StyleSheet.absoluteFill}
              accessibilityRole="adjustable"
              accessibilityLabel={`Gráfico${label ? ` de ${label}` : ''}. ${point.title}: ${point.detail}`}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={pick}
              onResponderMove={pick}
            />
          </>
        ) : null}
      </View>
      {overlay || reference ? (
        <Legend
          items={[
            { label: label ?? 'Valor', color },
            ...(overlay ? [{ label: overlay.label, color: overlay.color ?? colors.series2 }] : []),
            ...(reference ? [{ label: reference.label, color: colors.gold, dashed: true }] : []),
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  yTick: { position: 'absolute', left: 0, width: PAD.left - 6, textAlign: 'right', fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  xTick: { position: 'absolute', bottom: 0, fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  empty: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surfaceAlt, paddingHorizontal: 24 },
  emptyText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, textAlign: 'center' },
});
