import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space, type } from '@/theme';

interface ScreenProps {
  title?: string;
  subtitle?: string;
  /** Exibe botão de voltar (telas empilhadas). */
  back?: boolean;
  right?: React.ReactNode;
  /** Conteúdo fixo abaixo do título (ex.: filtros). */
  sticky?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Espaço extra no fim (telas com barra de abas já recebem o inset). */
  bottomInset?: number;
}

export const CONTENT_MAX_WIDTH = 560;

export function Screen({ title, subtitle, back, right, sticky, children, scroll = true, onRefresh, refreshing, bottomInset = 0 }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {title ? (
        <View style={styles.header}>
          <View style={styles.headerInner}>
            {back ? (
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Voltar"
                style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}>
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </Pressable>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={back ? type.h2 : type.h1} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={[type.bodySm, { marginTop: 1 }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {right}
          </View>
          {sticky ? <View style={[styles.headerInner, { marginTop: space.md }]}>{sticky}</View> : null}
        </View>
      ) : null}
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl + bottomInset }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accentSoft} colors={[colors.accent]} progressBackgroundColor={colors.surface} />
            ) : undefined
          }>
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.bg,
  },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: space.md, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  back: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: { padding: space.lg, gap: space.lg, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
});
