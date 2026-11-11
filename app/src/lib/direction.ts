import { I18nManager, Platform } from 'react-native';

import type { Language } from '@/theme/tokens';

/**
 * textAlign for the start or end edge of the reading direction.
 * The physical side follows the language (Arabic starts on the right). On Android and iOS,
 * React Native swaps 'left' and 'right' while I18nManager is right-to-left, so the value is
 * swapped back to land on the right side; the web build never swaps. Basing this on the
 * real I18nManager state keeps text right even when the native direction could not be
 * switched (for example a phone in Arabic using the app in English, before the reload).
 */
export function textAlignFor(edge: 'start' | 'end', language: Language): 'left' | 'right' {
  const physicalStart = language === 'ar' ? 'right' : 'left';
  const swapped = Platform.OS !== 'web' && I18nManager.isRTL;
  const start = swapped ? (physicalStart === 'left' ? 'right' : 'left') : physicalStart;
  const end = start === 'left' ? 'right' : 'left';
  return edge === 'start' ? start : end;
}

type Inset = `${number}%` | number;

/**
 * Absolute position from the start edge of the reading direction. React Native maps `start`
 * to the right edge in right-to-left layouts; the web build ignores `start` for positioning,
 * so it gets the physical side for the language.
 */
export function insetStart(value: Inset, language: Language) {
  if (Platform.OS !== 'web') return { start: value };
  return language === 'ar' ? { right: value } : { left: value };
}

/** Absolute position from the end edge of the reading direction (see insetStart). */
export function insetEnd(value: Inset, language: Language) {
  if (Platform.OS !== 'web') return { end: value };
  return language === 'ar' ? { left: value } : { right: value };
}

/**
 * Layout direction for a screen's root view, from the UI language. Normally I18nManager
 * already matches (the app reloads when the language changes direction). Setting it on the
 * root as well keeps rows, start/end positions and the reading order right even when the
 * native direction cannot be switched, for example in Expo Go without RTL support, and inside
 * modals, which start a new layout root.
 */
export function layoutDirection(language: Language): { direction: 'rtl' | 'ltr' } {
  return { direction: language === 'ar' ? 'rtl' : 'ltr' };
}
