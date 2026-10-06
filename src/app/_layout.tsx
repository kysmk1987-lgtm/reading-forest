import '@/lib/i18n';

import { Jua_400Regular } from '@expo-google-fonts/jua/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '@/components/ui';
import { useAuthListener } from '@/features/auth/useAuth';
import { GrowthCelebration } from '@/features/forest/GrowthCelebration';
import { CheerLayer } from '@/features/together/CheerLayer';
import { PresenceBridge } from '@/features/together/PresenceBridge';
import { TimerWatcher } from '@/features/together/TimerWatcher';
import { queryClient } from '@/lib/queryClient';
import { colors, MAX_APP_WIDTH, palette } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Jua_400Regular, Nunito_600SemiBold, Nunito_800ExtraBold });
  useAuthListener();

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <View style={styles.page}>
          <View style={styles.phone}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="search" />
              <Stack.Screen name="book/[id]" />
              <Stack.Screen name="forest/[slug]" />
              <Stack.Screen name="auth/callback" />
              <Stack.Screen name="gallery" />
              <Stack.Screen name="trees" />
              <Stack.Screen name="room/[id]" />
              <Stack.Screen name="card/new" />
              <Stack.Screen name="card/[id]" />
              <Stack.Screen name="wrapped" options={{ animation: 'fade' }} />
            </Stack>
            <PresenceBridge />
            <TimerWatcher />
            <GrowthCelebration />
            <CheerLayer />
            <ToastHost />
          </View>
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Platform.OS === 'web' ? palette.leafSoft : colors.background, alignItems: 'center' },
  phone: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_APP_WIDTH,
    backgroundColor: colors.background,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { boxShadow: '0px 0px 40px rgba(91,70,54,0.12)' } : null),
  },
});
