/**
 * Phone, tablet or desktop layout from the window width (docs/desktop-plan.md, Section 1).
 * Phones in Expo Go are always "phone"; a browser window switches live when it is resized.
 */
import { useWindowDimensions, type ViewStyle } from 'react-native';

import { layout } from '@/theme/tokens';

export type LayoutSize = 'phone' | 'tablet' | 'desktop';

export function layoutFor(width: number): LayoutSize {
  if (width >= layout.desktopMin) return 'desktop';
  if (width >= layout.tabletMin) return 'tablet';
  return 'phone';
}

export function useLayout(): LayoutSize {
  return layoutFor(useWindowDimensions().width);
}

/**
 * Width cap for a screen's content: full width on phones, a centred column elsewhere.
 * "narrow" is for short forms (language, sign-in, sign-up).
 */
export function columnStyle(size: LayoutSize, kind: 'page' | 'narrow' = 'page'): ViewStyle | null {
  if (size === 'phone') return null;
  const maxWidth =
    kind === 'narrow'
      ? layout.narrowColumn
      : size === 'tablet'
        ? layout.tabletColumn
        : layout.column;
  return { width: '100%', maxWidth, alignSelf: 'center' };
}

/** Shorthand for screens: the column style for the current window. */
export function useColumn(kind: 'page' | 'narrow' = 'page'): ViewStyle | null {
  return columnStyle(useLayout(), kind);
}

// Screens that start with the navy band (DESIGN.md Section 2): the entry screens, each role's
// first screen and the professor profile.
const BAND_ON_TOP = /^\/(sign-in|sign-up|home|staff\/status|admin\/overview|professors\/\d+)\/?$/;

/**
 * Whether the screen at this path has the band under the phone's status bar. The band is dark
 * in both themes, so the status bar needs light icons there even in the light theme.
 */
export function bandOnTop(pathname: string): boolean {
  return BAND_ON_TOP.test(pathname);
}
