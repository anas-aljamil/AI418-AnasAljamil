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
