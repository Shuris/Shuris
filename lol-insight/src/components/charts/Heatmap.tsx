import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { pct, WEEKDAYS } from '@/stats/format';
import { HEAT_BLOCK_HOURS, HEAT_BLOCKS, type HeatCell } from '@/stats/timeseries';
import { colors, fonts } from '@/theme';

import { Readout } from './Readout';

/** Células com menos partidas que isto aparecem esmaecidas (amostra pequena). */
const MIN_RELIABLE = 3;

const NEG = [229, 96, 106];
const MID = [58, 66, 80];
const POS = [61, 139, 255];
const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;

/** Escala divergente: vermelho (<50%) — cinza neutro (50%) — azul (>50%). */
export function winRateColor(wr: number): string {
  const t = Math.max(-1, Math.min(1, (wr - 0.5) / 0.3));
  return t >= 0 ? mix(MID, POS, t) : mix(MID, NEG, -t);
}

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function Heatmap({ cells }: { cells: HeatCell[] }) {
  const [selected, setSelected] = useState<HeatCell | null>(null);
  const reliable = cells.filter((c) => c.games >= MIN_RELIABLE);
  const best = [...reliable].sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0) || b.games - a.games)[0];
  const active = selected ?? best;
  const hours = (c: HeatCell) => `${c.block * HEAT_BLOCK_HOURS}h–${c.block * HEAT_BLOCK_HOURS + HEAT_BLOCK_HOURS}h`;

  return (
    <View>
      {active ? (
        <Readout
          title={`${WEEKDAYS[active.day]} · ${hours(active)}${!selected ? ' · melhor faixa' : ''}`}
          detail={
            active.games
              ? `${pct(active.winRate ?? 0)} de vitórias · ${active.wins}V ${active.games - active.wins}D${active.games < MIN_RELIABLE ? ' · amostra pequena' : ''}`
              : 'Nenhuma partida nesta faixa'
          }
          hint={!selected ? 'Toque em uma célula' : undefined}
          color={active.games ? winRateColor(active.winRate ?? 0.5) : colors.surfaceHigh}
        />
      ) : (
        <Readout title="Sem dados" detail="Nenhuma faixa com partidas suficientes" />
      )}
      <View style={styles.grid}>
        <View style={styles.hoursCol}>
          <View style={{ height: 18 }} />
          {HEAT_BLOCKS.map((h) => (
            <View key={h} style={styles.hourCell}>
              <Text style={styles.axis}>{h}</Text>
            </View>
          ))}
        </View>
        {DAY_ORDER.map((day) => (
          <View key={day} style={styles.dayCol}>
            <Text style={[styles.axis, { height: 18, textAlign: 'center' }]}>{WEEKDAYS[day]}</Text>
            {HEAT_BLOCKS.map((_, block) => {
              const c = cells[day * 8 + block];
              const isActive = active === c;
              const small = c.games > 0 && c.games < MIN_RELIABLE;
              return (
                <Pressable
                  key={block}
                  onPress={() => setSelected(c)}
                  accessibilityRole="button"
                  accessibilityLabel={`${WEEKDAYS[day]} ${hours(c)}: ${c.games ? `${pct(c.winRate ?? 0)} em ${c.games} partidas` : 'sem partidas'}`}
                  style={[
                    styles.cell,
                    c.games
                      ? { backgroundColor: winRateColor(c.winRate ?? 0.5), opacity: small ? 0.38 : 1 }
                      : { backgroundColor: colors.surfaceAlt },
                    isActive && styles.cellActive,
                  ]}>
                  {c.games >= MIN_RELIABLE ? <Text style={styles.cellText}>{Math.round((c.winRate ?? 0) * 100)}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <Text style={styles.axis}>30%</Text>
        <View style={styles.ramp}>
          {[0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map((v) => (
            <View key={v} style={{ flex: 1, backgroundColor: winRateColor(v) }} />
          ))}
        </View>
        <Text style={styles.axis}>70%+ de vitórias</Text>
        <View style={[styles.sample, { opacity: 0.38, backgroundColor: winRateColor(0.5) }]} />
        <Text style={styles.axis}>menos de {MIN_RELIABLE} partidas</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 2 },
  hoursCol: { width: 26, gap: 2 },
  hourCell: { height: 30, justifyContent: 'center' },
  dayCol: { flex: 1, gap: 2 },
  cell: { height: 30, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  cellActive: { borderWidth: 2, borderColor: '#FFFFFF' },
  cellText: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: 'rgba(255,255,255,0.95)' },
  axis: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  legend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  ramp: { flexDirection: 'row', width: 84, height: 8, borderRadius: 4, overflow: 'hidden' },
  sample: { width: 10, height: 10, borderRadius: 3, marginLeft: 6 },
});
