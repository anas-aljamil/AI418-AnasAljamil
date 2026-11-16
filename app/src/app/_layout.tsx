/**
 * Root layout: loads the IBM Plex fonts, the saved language and the saved session before
 * hiding the splash screen (no flash of fallback text, wrong direction or the sign-in screen),
 * then provides safe areas, strings, theme, sign-in state, server data and toasts.
 */
import { useEffect, useState } from 'react';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';
import { Platform, StyleSheet, View } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import i18n, { initI18n } from '@/i18n';
import { persistOptions, queryClient } from '@/api/queryClient';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { SettingsProvider } from '@/settings/SettingsProvider';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { SkipLink } from '@/components/SkipLink';
import { ToastProvider } from '@/components/Toast';
import { layoutDirection } from '@/lib/direction';
import { bandOnTop } from '@/lib/layout';
import { markSignedIn, pageTitle, pageTitleKey } from '@/lib/nav';
import { useVisibleNotifications } from '@/features/notifications/useVisibleNotifications';

// In the browser the navigators keep every visited screen in the page. With screens enabled,
// a screen that is not shown gets display: none and the hidden attribute, so the Tab key and
// screen readers cannot reach it (they could, behind the open tab). Phones already have this.
if (Platform.OS === 'web') enableScreens(true);

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AppShell() {
  const { scheme, colors } = useTheme();
  const pathname = usePathname();
  const { state } = useAuth();
  const { t, i18n: strings } = useTranslation();
  const direction = layoutDirection(strings.language === 'ar' ? 'ar' : 'en');
  const restoring = state.status === 'restoring';
  useEffect(() => {
    if (!restoring) SplashScreen.hideAsync().catch(() => undefined);
  }, [restoring]);

  const signedIn = state.status === 'signedIn';
  useEffect(() => {
    if (signedIn) markSignedIn();
  }, [signedIn]);

  // Browser only. The tab is named after the screen, with the bell's unread count in front
  // ("(2) Appointments | Mawjood"). My status writes the live status there itself.
  const { unread } = useVisibleNotifications();
  const titleKey = pageTitleKey(pathname);
  const ownTitle = pathname.replace(/\/+$/, '') === '/staff/status';
  useEffect(() => {
    if (Platform.OS !== 'web' || ownTitle) return;
    document.title = pageTitle(titleKey ? t(titleKey) : null, t('app.name'), unread);
  }, [ownTitle, titleKey, t, unread]);

  // The browser's own bar takes the colour at the top of the screen: the band's navy on the
  // screens that start with it, the page ground elsewhere.
  const barColor = bandOnTop(pathname) ? colors.band : colors.bg;
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      meta.setAttribute('content', barColor);
    }
  }, [barColor]);
  if (restoring) return null;
  return (
    <View style={[styles.fill, direction]}>
      {/* Light icons on the dark theme, and over the navy band in either theme. */}
      <StatusBar style={scheme === 'dark' || bandOnTop(pathname) ? 'light' : 'dark'} />
      <SkipLink />
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
    IBMPlexSansArabic_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
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
