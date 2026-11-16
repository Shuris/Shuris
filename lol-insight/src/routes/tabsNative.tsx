import { Tabs } from 'expo-router';
import React from 'react';

import { TabBar } from '@/components/TabBar';
import { colors } from '@/theme';

/** Abas inferiores do aplicativo Android (experiência minimalista). */
export function NativeTabs() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg }, animation: 'fade' }}>
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="desempenho" options={{ title: 'Desempenho' }} />
      <Tabs.Screen name="campeoes" options={{ title: 'Campeões' }} />
      <Tabs.Screen name="partidas" options={{ title: 'Partidas' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
