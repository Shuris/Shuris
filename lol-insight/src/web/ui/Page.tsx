import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { FadeIn } from '@/components/ui';
import { colors, fonts, space } from '@/theme';

import { useBreakpoint } from '../hooks';

export const PAGE_MAX = 1320;

/** Página da versão web: cabeçalho com título, ações e conteúdo rolável centralizado. */
export function Page({
  title,
  subtitle,
  eyebrow,
  actions,
  children,
  toolbar,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  /** Filtros fixos logo abaixo do cabeçalho. */
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { narrow } = useBreakpoint();
  const pad = narrow ? space.lg : 32;
  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingHorizontal: pad, paddingTop: narrow ? space.lg : 28, paddingBottom: 64 }} keyboardShouldPersistTaps="handled">
      <View style={styles.inner}>
        <View style={[styles.head, narrow && { flexDirection: 'column', alignItems: 'flex-start' }]}>
          <View style={{ flex: 1, gap: 4 }}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text style={[styles.title, narrow && { fontSize: 26 }]} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
        {toolbar ? <View style={styles.toolbar}>{toolbar}</View> : null}
        <FadeIn style={{ gap: 20 }}>{children}</FadeIn>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: { width: '100%', maxWidth: PAGE_MAX, alignSelf: 'center', gap: 20 },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: space.lg },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.4, color: colors.gold, textTransform: 'uppercase' },
  title: { fontFamily: fonts.title, fontSize: 32, color: colors.text, letterSpacing: 0.3 },
  subtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center', paddingVertical: space.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.hairline },
});
