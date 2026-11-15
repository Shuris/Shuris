import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import type { PathPoint } from '@/coach';
import { absoluteLabel, absoluteToRank, rankShort } from '@/stats/rank';
import { colors, fonts } from '@/theme';

import { Legend, Readout } from './Readout';

interface ProjectionChartProps {
  path: PathPoint[];
  /** Meta de elo, desenhada como linha de referência quando cabe no gráfico. */
  goalAbs?: number | null;
  height?: number;
}

const PAD = { top: 12, bottom: 22, left: 34, right: 12 };
/** Versão curta do elo, para caber na leitura do gráfico (ex.: "D2 16 LP"). */
const short = (abs: number) => {
  const r = absoluteToRank(abs);
  return `${rankShort(r)} ${r.lp} LP`;
};

/**
 * Progressão projetada do elo em 30 dias: faixa de incerteza (10%–90% das
 * simulações), projeção central e as medianas dos cenários conservador e
 * otimista. As linhas horizontais marcam as divisões.
 */
export function ProjectionChart({ path, goalAbs, height = 210 }: ProjectionChartProps) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const geo = useMemo(() => {
    const plotW = Math.max(0, width - PAD.left - PAD.right);
    const plotH = height - PAD.top - PAD.bottom;
    const values = path.flatMap((p) => [p.p10, p.p90, p.conservative, p.optimistic]);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (goalAbs && goalAbs > max && goalAbs - max < (max - min) * 0.6 + 60) max = goalAbs;
    const padV = Math.max(20, (max - min) * 0.08);
    min = Math.max(0, min - padV);
    max += padV;
    const lastDay = path[path.length - 1]?.day || 30;
    const x = (day: number) => PAD.left + (day / lastDay) * plotW;
    const y = (v: number) => PAD.top + plotH - ((v - min) / (max - min)) * plotH;
    const line = (get: (p: PathPoint) => number) => path.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)},${y(get(p)).toFixed(1)}`).join(' ');
    const band =
      path.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)},${y(p.p90).toFixed(1)}`).join(' ') +
      ' ' +
      [...path].reverse().map((p) => `L${x(p.day).toFixed(1)},${y(p.p10).toFixed(1)}`).join(' ') +
      ' Z';
    // Linhas de divisão (a cada 100 LP), espaçadas para caber no eixo.
    const span = max - min;
    const step = span <= 500 ? 100 : span <= 1000 ? 200 : 400;
    const ticks: number[] = [];
    for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(v);
    return { plotW, x, y, line, band, ticks, lastDay, inRange: (v: number) => v >= min && v <= max };
  }, [path, width, height, goalAbs]);

  if (path.length < 2) return null;
  const index = selected ?? path.length - 1;
  const point = path[index];

  const pick = (e: GestureResponderEvent) => {
    if (geo.plotW <= 0) return;
    const ratio = (e.nativeEvent.locationX - PAD.left) / geo.plotW;
    setSelected(Math.max(0, Math.min(path.length - 1, Math.round(ratio * (path.length - 1)))));
  };

  return (
    <View>
      <Readout
        title={point.day === 0 ? 'Hoje' : `Em ${point.day} dias`}
        detail={
          point.day === 0
            ? absoluteLabel(point.p50)
            : `Central: ${absoluteLabel(point.p50)}\nFaixa: ${short(point.p10)} a ${short(point.p90)}`
        }
        color={colors.series1}
      />
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <>
            <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
              {geo.ticks.map((t) => (
                <Line key={t} x1={PAD.left} x2={width - PAD.right} y1={geo.y(t)} y2={geo.y(t)} stroke={colors.grid} strokeWidth={1} />
              ))}
              {goalAbs && geo.inRange(goalAbs) ? (
                <Line x1={PAD.left} x2={width - PAD.right} y1={geo.y(goalAbs)} y2={geo.y(goalAbs)} stroke={colors.gold} strokeWidth={1} strokeDasharray="4 4" />
              ) : null}
              <Path d={geo.band} fill="rgba(57,135,229,0.18)" />
              <Path d={geo.line((p) => p.conservative)} stroke={colors.textSecondary} strokeWidth={1.5} strokeDasharray="5 4" fill="none" />
              <Path d={geo.line((p) => p.optimistic)} stroke={colors.series2} strokeWidth={1.5} strokeDasharray="5 4" fill="none" />
              <Path d={geo.line((p) => p.p50)} stroke={colors.series1} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              {selected !== null ? <Line x1={geo.x(point.day)} x2={geo.x(point.day)} y1={PAD.top} y2={height - PAD.bottom} stroke="rgba(255,255,255,0.28)" strokeWidth={1} /> : null}
              <Circle cx={geo.x(point.day)} cy={geo.y(point.p50)} r={5.5} fill={colors.series1} stroke={colors.surface} strokeWidth={2} />
            </Svg>
            {geo.ticks.map((t) => (
              <Text key={t} style={[styles.yTick, { top: geo.y(t) - 7 }]} numberOfLines={1}>
                {rankShort(absoluteToRank(t))}
              </Text>
            ))}
            {[0, 7, 15, 30].filter((d) => d <= geo.lastDay).map((d) => (
              <Text key={d} style={[styles.xTick, d === 0 ? { left: PAD.left } : d === geo.lastDay ? { right: PAD.right, textAlign: 'right' } : { left: geo.x(d) - 30, width: 60, textAlign: 'center' }]}>
                {d === 0 ? 'Hoje' : `${d} dias`}
              </Text>
            ))}
            <View
              style={StyleSheet.absoluteFill}
              accessibilityRole="adjustable"
              accessibilityLabel={`Gráfico de progressão projetada. ${point.day === 0 ? 'Hoje' : `Em ${point.day} dias`}: ${absoluteLabel(point.p50)}`}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={pick}
              onResponderMove={pick}
            />
          </>
        ) : null}
      </View>
      <Legend
        items={[
          { label: 'Projeção central', color: colors.series1 },
          { label: 'Faixa de 80% das simulações', color: 'rgba(57,135,229,0.45)' },
          { label: 'Otimista', color: colors.series2, dashed: true },
          { label: 'Conservador', color: colors.textSecondary, dashed: true },
          ...(goalAbs && geo.inRange(goalAbs) ? [{ label: 'Meta', color: colors.gold, dashed: true }] : []),
        ]}
      />
      {selected !== null && point.day > 0 ? (
        <Text style={styles.note}>
          Otimista: {short(point.optimistic)} · Conservador: {short(point.conservative)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  yTick: { position: 'absolute', left: 0, width: PAD.left - 6, textAlign: 'right', fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  xTick: { position: 'absolute', bottom: 0, fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  note: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textSecondary, marginTop: 8 },
});
