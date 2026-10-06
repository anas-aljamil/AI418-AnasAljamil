/**
 * Root layout: loads the IBM Plex fonts, the saved language and the saved session before
 * hiding the splash screen (no flash of fallback text, wrong direction or the sign-in screen),
 * then provides safe areas, strings, theme, sign-in state, server data and toasts.
 */
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import { StyleSheet, View } from 'react-native';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import i18n, { initI18n } from '@/i18n';
import { persistOptions, queryClient } from '@/api/queryClient';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { SettingsProvider } from '@/settings/SettingsProvider';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { ToastProvider } from '@/components/Toast';
import { layoutDirection } from '@/lib/direction';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AppShell() {
  const { scheme, colors } = useTheme();
  const { state } = useAuth();
  const { i18n: strings } = useTranslation();
  const direction = layoutDirection(strings.language === 'ar' ? 'ar' : 'en');
  const restoring = state.status === 'restoring';
  useEffect(() => {
    if (!restoring) SplashScreen.hideAsync().catch(() => undefined);
  }, [restoring]);
  if (restoring) return null;
  return (
    <View style={[styles.fill, direction]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
  });
  const [languageReady, setLanguageReady] = useState(false);

  useEffect(() => {
    initI18n().finally(() => setLanguageReady(true));
  }, []);

  if (!(fontsLoaded || fontError) || !languageReady) return null;

  return (
    <SafeAreaProvider>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <SettingsProvider>
            <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
              <AuthProvider>
                <ToastProvider>
                  <AppShell />
                </ToastProvider>
              </AuthProvider>
            </PersistQueryClientProvider>
          </SettingsProvider>
        </ThemeProvider>
      </I18nextProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
