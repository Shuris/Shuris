import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CoachProvider } from '@/state/CoachContext';
import { PlayerProvider } from '@/state/PlayerContext';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({ Sora_600SemiBold, Sora_700Bold, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold });
  const ready = loaded || !!error;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider>
      <PlayerProvider>
        <CoachProvider>
        <StatusBar style="light" />
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
        </Stack>
        </CoachProvider>
      </PlayerProvider>
    </SafeAreaProvider>
  );
}
