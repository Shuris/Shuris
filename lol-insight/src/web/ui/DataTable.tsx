import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, space } from '@/theme';

import { css } from '../hooks';
import { InfoTip } from './Tooltip';

export interface Column<T> {
  key: string;
  label: string;
  /** Largura fixa (px) ou peso flexível. */
  width?: number;
  flex?: number;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => React.ReactNode;
  /** Valor usado para ordenar; sem ele a coluna não é ordenável. */
  sort?: (row: T) => number | string;
  info?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowPress?: (row: T) => void;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  /** Linhas exibidas antes do "Mostrar mais". */
  pageSize?: number;
  empty?: string;
  /** Largura mínima da tabela: abaixo disso ela rola na horizontal. */
  minWidth?: number;
  rowLabel?: (row: T) => string;
}

/** Tabela ordenável da versão web: cabeçalho clicável, linhas com foco e paginação simples. */
export function DataTable<T>({ columns, rows, rowKey, onRowPress, initialSort, pageSize = 25, empty = 'Nada para mostrar.', minWidth = 640, rowLabel }: Props<T>) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [shown, setShown] = useState(pageSize);
  const [hover, setHover] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const f = col.sort;
    return [...rows].sort((a, b) => {
      const va = f(a);
      const vb = f(b);
      const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR');
      return sort.dir === 'asc' ? r : -r;
    });
  }, [rows, sort, columns]);

  const cell = (c: Column<T>) => ({ width: c.width, flex: c.width ? undefined : (c.flex ?? 1), alignItems: c.align === 'right' ? ('flex-end' as const) : c.align === 'center' ? ('center' as const) : ('flex-start' as const) });

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ flex: 1, minWidth }} accessibilityRole="none">
        <View style={styles.headRow}>
          {columns.map((c) => {
            const active = sort?.key === c.key;
            return (
              <Pressable
                key={c.key}
                disabled={!c.sort}
                onPress={() => setSort(active ? { key: c.key, dir: sort!.dir === 'desc' ? 'asc' : 'desc' } : { key: c.key, dir: 'desc' })}
                accessibilityRole={c.sort ? 'button' : undefined}
                accessibilityLabel={c.sort ? `Ordenar por ${c.label}` : c.label}
                style={[styles.headCell, cell(c), c.sort ? css({ cursor: 'pointer' }) : null]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={[styles.headText, active && { color: colors.text }]} numberOfLines={1}>
                    {c.label}
                  </Text>
                  {c.info ? <InfoTip text={c.info} /> : null}
                  {active ? <Ionicons name={sort!.dir === 'desc' ? 'arrow-down' : 'arrow-up'} size={11} color={colors.accentSoft} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        {sorted.length === 0 ? <Text style={styles.empty}>{empty}</Text> : null}
        {sorted.slice(0, shown).map((r) => {
          const k = rowKey(r);
          return (
            <Pressable
              key={k}
              disabled={!onRowPress}
              onPress={() => onRowPress?.(r)}
              onHoverIn={() => setHover(k)}
              onHoverOut={() => setHover((h) => (h === k ? null : h))}
              accessibilityRole={onRowPress ? 'link' : undefined}
              accessibilityLabel={rowLabel?.(r)}
              style={[styles.row, hover === k && onRowPress ? { backgroundColor: colors.surfaceAlt } : null, onRowPress ? css({ cursor: 'pointer' }) : null]}>
              {columns.map((c) => (
                <View key={c.key} style={[styles.cell, cell(c)]}>
                  {c.render(r)}
                </View>
              ))}
            </Pressable>
          );
        })}
        {sorted.length > shown ? (
          <Pressable onPress={() => setShown((s) => s + pageSize)} style={[styles.more, css({ cursor: 'pointer' })]} accessibilityRole="button">
            <Text style={styles.moreText}>
              Mostrar mais ({sorted.length - shown} restantes)
            </Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

/** Texto padrão de célula. */
export function T({ children, strong, muted, color, mono, cell }: { children: React.ReactNode; strong?: boolean; muted?: boolean; color?: string; mono?: boolean; /** Ocupa uma coluna de linha chave–valor, alinhado à direita. */ cell?: boolean }) {
  return (
    <Text
      numberOfLines={1}
      style={[styles.text, strong && { fontFamily: fonts.bodyBold, color: colors.text }, muted && { color: colors.textMuted }, mono && { fontFamily: fonts.display, fontSize: 15 }, color ? { color } : null, cell && { flex: 1, textAlign: 'right' }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: space.sm },
  headCell: { paddingVertical: 10, paddingHorizontal: 8, justifyContent: 'center' },
  headText: { fontFamily: fonts.bodySemi, fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.hairline, paddingHorizontal: space.sm, minHeight: 46 },
  cell: { paddingVertical: 8, paddingHorizontal: 8, justifyContent: 'center' },
  text: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, padding: space.lg, textAlign: 'center' },
  more: { padding: space.md, alignItems: 'center' },
  moreText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.accentSoft },
});
