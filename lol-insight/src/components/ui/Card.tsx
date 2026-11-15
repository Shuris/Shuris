import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, space, type } from '@/theme';

export function Card({ children, style, padded = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return <View style={[styles.card, padded && styles.padded, style]}>{children}</View>;
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  /** Pequeno rótulo acima do título (ex.: "Gráfico 1"). */
  eyebrow?: string;
  right?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, eyebrow, right }: SectionHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={[type.label, { color: colors.gold, marginBottom: 3 }]}>{eyebrow}</Text> : null}
        <Text style={type.h2}>{title}</Text>
        {subtitle ? <Text style={[type.bodySm, { marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  padded: { padding: space.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginBottom: space.md },
});
