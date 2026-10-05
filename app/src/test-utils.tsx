import { render } from '@testing-library/react-native';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n, { resources } from '@/i18n';
import { ThemeProvider } from '@/theme/ThemeProvider';
import type { Language } from '@/theme/tokens';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Render inside the real providers (theme, i18n, safe areas) in the given language. */
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
        <ThemeProvider>{ui}</ThemeProvider>
      </I18nextProvider>
    </SafeAreaProvider>,
  );
}
