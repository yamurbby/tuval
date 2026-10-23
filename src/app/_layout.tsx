import {
  EBGaramond_400Regular,
  EBGaramond_400Regular_Italic,
  EBGaramond_500Medium,
  EBGaramond_600SemiBold,
  useFonts,
} from '@expo-google-fonts/eb-garamond';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Loading } from '../components/ui';
import { AppProvider, useApp } from '../state/AppContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { ready, t, theme } = useApp();
  // Yazı tipi yüklenemezse sistem yazı tipiyle devam edilir (çevrimdışı da çalışır: dosyalar pakette)
  const [fontsLoaded, fontError] = useFonts({
    EBGaramond_400Regular,
    EBGaramond_400Regular_Italic,
    EBGaramond_500Medium,
    EBGaramond_600SemiBold,
  });
  const fontsDone = fontsLoaded || !!fontError;
  useEffect(() => {
    if (ready && fontsDone) SplashScreen.hideAsync().catch(() => {});
  }, [ready, fontsDone]);

  if (!ready || !fontsDone) return <Loading label={t('common.loading')} />;
  return (
    <ErrorBoundary title={t('errors.title')} body={t('errors.body')} retry={t('common.retry')}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.paper }, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="game" options={{ gestureEnabled: false }} />
        <Stack.Screen name="complete" options={{ gestureEnabled: false }} />
      </Stack>
    </ErrorBoundary>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Root />
      </AppProvider>
    </SafeAreaProvider>
  );
}
