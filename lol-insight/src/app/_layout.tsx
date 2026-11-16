import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { MarcellusSC_400Regular } from '@expo-google-fonts/marcellus-sc';
import { Rajdhani_600SemiBold, Rajdhani_700Bold } from '@expo-google-fonts/rajdhani';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NotificationsBridge } from '@/components/NotificationsBridge';
import { AuthProvider } from '@/state/AuthContext';
import { CoachProvider } from '@/state/CoachContext';
import { PlayerProvider } from '@/state/PlayerContext';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    MarcellusSC_400Regular,
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  const ready = loaded || !!error;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider>
      <AuthProvider>
      <PlayerProvider>
        <CoachProvider>
        <StatusBar style="light" />
        <NotificationsBridge />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'slide_from_right',
          }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="campeao/[id]" />
          <Stack.Screen name="partida/[id]" />
          <Stack.Screen name="insights" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="academy/index" />
          <Stack.Screen name="academy/aulas" />
          <Stack.Screen name="academy/aula/[id]" />
          <Stack.Screen name="academy/plano" />
          <Stack.Screen name="previsao" />
          <Stack.Screen name="comparar" />
          <Stack.Screen name="caderno" />
          <Stack.Screen name="compartilhar" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="notificacoes" />
          <Stack.Screen name="entrar" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="cadastro" />
          <Stack.Screen name="recuperar-senha" />
          <Stack.Screen name="verificar-email" />
          <Stack.Screen name="conta/index" />
          <Stack.Screen name="conta/configuracoes" />
          <Stack.Screen name="conta/riot" />
          <Stack.Screen name="conta/sessoes" />
        </Stack>
        </CoachProvider>
      </PlayerProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
