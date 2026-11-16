import { Ionicons } from '@expo/vector-icons';
import type { Tabs } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/components/ui/Motion';
import { colors, fonts } from '@/theme';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
type IconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, [IconName, IconName]> = {
  index: ['home-outline', 'home'],
  desempenho: ['stats-chart-outline', 'stats-chart'],
  campeoes: ['shield-outline', 'shield'],
  partidas: ['list-outline', 'list'],
  perfil: ['person-outline', 'person'],
};

/** Barra de navegação inferior com as cinco seções do app. */
export function TabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.inner}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const title = descriptors[route.key].options.title ?? route.name;
          const [off, on] = ICONS[route.name] ?? ['ellipse-outline', 'ellipse'];
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              haptic.select();
              navigateToTab(route.key);
            }
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={title}
              style={styles.item}>
              <View style={[styles.indicator, focused && { backgroundColor: colors.accent }]} />
              <Ionicons name={focused ? on : off} size={21} color={focused ? colors.accentSoft : colors.textMuted} />
              <Text style={[styles.label, focused && { color: colors.text }]} numberOfLines={1}>
                {title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.hairline },
  inner: { flexDirection: 'row', width: '100%', maxWidth: 560, alignSelf: 'center' },
  item: { flex: 1, alignItems: 'center', gap: 3, paddingBottom: 4, minHeight: 54 },
  indicator: { width: 26, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, marginBottom: 6, backgroundColor: 'transparent' },
  label: { fontFamily: fonts.bodySemi, fontSize: 10.5, color: colors.textMuted },
});
