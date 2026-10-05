import { render } from '@testing-library/react-native';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import i18n, { resources } from '@/i18n';
import { ToastProvider } from '@/components/Toast';
import { SettingsProvider } from '@/settings/SettingsProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';
import type { Language } from '@/theme/tokens';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * Render inside the real providers (safe areas, i18n, theme, a fresh data cache without
 * retries, toasts) in the given language.
 */
export async function renderWithProviders(ui: React.ReactElement, language: Language = 'en') {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources,
      lng: language,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
    });
  } else {
    await i18n.changeLanguage(language);
  }
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <QueryClientProvider
            client={
              new QueryClient({
                defaultOptions: {
                  // No retries, and no cache-cleanup timers left running after a test.
                  queries: { retry: false, gcTime: Infinity },
                  mutations: { gcTime: Infinity },
                },
              })
            }
          >
            <SettingsProvider>
              <ToastProvider>{ui}</ToastProvider>
            </SettingsProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </I18nextProvider>
    </SafeAreaProvider>,
  );
}

/** Departments as the API returns them (each with its college), for mocked responses. */
export const testCollege = {
  college_id: 1,
  code: 'CCS',
  name_ar: 'كلية علوم الحاسب والأمن السيبراني',
  name_en: 'College of Computer and Cyber Sciences',
};
export function testDepartment(
  department_id: number,
  code: string,
  name_ar: string,
  name_en: string,
) {
  return { department_id, code, name_ar, name_en, college: testCollege };
}
