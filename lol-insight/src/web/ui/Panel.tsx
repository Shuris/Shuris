import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, space } from '@/theme';

import { useBreakpoint } from '../hooks';
import { InfoTip } from './Tooltip';

/** Bloco de conteúdo da versão web. Sem bordas fortes: separa pelo tom do fundo. */
export function Panel({
  title,
  subtitle,
  info,
  right,
  children,
  style,
  padded = true,
}: {
  title?: string;
  subtitle?: string;
  /** Explicação curta exibida ao passar o mouse no "i". */
  info?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return (
    <View style={[styles.panel, padded && styles.padded, style]}>
      {title ? (
        <View style={[styles.head, !padded && { paddingHorizontal: 20, paddingTop: 18 }]}>
          <View style={{ flex: 1, minWidth: 220, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.title}>{title}</Text>
              {info ? <InfoTip text={info} /> : null}
            </View>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/**
 * Grade responsiva: cada filho ocupa uma coluna; o número de colunas cai com a
 * largura (ex.: 3 no desktop, 2 no tablet, 1 no celular).
 */
export function Cols({ children, lg = 3, md = 2, gap = 20, style }: { children: React.ReactNode; lg?: number; md?: number; gap?: number; style?: StyleProp<ViewStyle> }) {
  const { bp } = useBreakpoint();
  const n = bp === 'xl' || bp === 'lg' ? lg : bp === 'md' ? md : 1;
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gap / 2, rowGap: gap }, style]}>
      {items.map((c, i) => (
        <View key={i} style={{ width: `${100 / n}%`, paddingHorizontal: gap / 2 }}>
          {c}
        </View>
      ))}
    </View>
  );
}

/** Duas colunas de larguras diferentes (ex.: 2/3 + 1/3); empilha em telas estreitas. */
export function Split({ children, ratio = 2, gap = 20 }: { children: [React.ReactNode, React.ReactNode]; ratio?: number; gap?: number }) {
  const { wide } = useBreakpoint();
  if (!wide) return <View style={{ gap }}>{children}</View>;
  return (
    <View style={{ flexDirection: 'row', gap, alignItems: 'flex-start' }}>
      <View style={{ flex: ratio, minWidth: 0 }}>{children[0]}</View>
      <View style={{ flex: 1, minWidth: 0 }}>{children[1]}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.hairline },
  padded: { padding: 20 },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: space.md, marginBottom: space.lg },
  title: { fontFamily: fonts.title, fontSize: 18, color: colors.text, letterSpacing: 0.2 },
  subtitle: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary },
});
