/**
 * Arabic / English strings and layout direction.
 *
 * Direction on native comes from I18nManager, which only takes effect after a
 * reload, so changing between Arabic and English saves the choice, flips the
 * direction and reloads the app (reloadAppAsync works in Expo Go and in release
 * builds). On the web build the document's dir attribute changes in place.
 */
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager, Platform } from 'react-native';
import { getLocales } from 'expo-localization';
import { reloadAppAsync } from 'expo';

import { preferenceKeys, readPreference, writePreference } from '@/lib/storage';
import type { Language } from '@/theme/tokens';
import ar from './ar.json';
import en from './en.json';

export const resources = { ar: { translation: ar }, en: { translation: en } } as const;

const i18n = createInstance();
/** False until the user has picked a language once (first launch shows the language screen). */
let languageChosen = false;

export function isLanguageChosen(): boolean {
  return languageChosen;
}

export function deviceLanguage(): Language {
  return getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'en';
}

function applyWebDirection(language: Language) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }
}

/** Load the saved language (or the device's), and line native direction up with it. */
export async function initI18n(): Promise<Language> {
  const stored = await readPreference(preferenceKeys.language);
  languageChosen = stored === 'ar' || stored === 'en';
  const language: Language = stored === 'ar' || stored === 'en' ? stored : deviceLanguage();
  await i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  applyWebDirection(language);
  if (Platform.OS !== 'web') {
    I18nManager.allowRTL(true);
    if (I18nManager.isRTL !== (language === 'ar')) {
      I18nManager.forceRTL(language === 'ar');
      await reloadAppAsync('Apply layout direction for the saved language');
    }
  }
  return language;
}

/**
 * Choose or switch the language. Resolves after the change on web and when the direction
 * already matches; otherwise the native app reloads (and this never resolves).
 */
export async function switchLanguage(language: Language): Promise<void> {
  await writePreference(preferenceKeys.language, language);
  languageChosen = true;
  await i18n.changeLanguage(language);
  applyWebDirection(language);
  if (Platform.OS !== 'web' && I18nManager.isRTL !== (language === 'ar')) {
    I18nManager.forceRTL(language === 'ar');
    await reloadAppAsync('Switch layout direction for the new language');
  }
}

export function currentLanguage(): Language {
  return i18n.language === 'ar' ? 'ar' : 'en';
}

export default i18n;
