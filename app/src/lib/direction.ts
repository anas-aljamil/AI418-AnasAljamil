import { Platform } from 'react-native';

import type { Language } from '@/theme/tokens';

/**
 * textAlign for the start or end edge of the reading direction.
 * On Android and iOS, React Native swaps 'left' and 'right' in right-to-left layouts, so
 * 'left' already means the start edge there. The web build does not swap, so it needs the
 * physical side for the language.
 */
export function textAlignFor(edge: 'start' | 'end', language: Language): 'left' | 'right' {
  const start = Platform.OS === 'web' && language === 'ar' ? 'right' : 'left';
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
