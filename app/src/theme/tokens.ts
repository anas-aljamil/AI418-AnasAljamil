/**
 * Design tokens: the single source for colour, type, space, shape, elevation and motion.
 * Values come from docs/DESIGN.md Section 11 (Direction A "Nameplate" with square lit doors).
 * Components never hard-code these values (enforced by the lint rule in eslint.config.js).
 */

export type ColorScheme = 'light' | 'dark';
export type StatusKey = 'in_office' | 'in_class' | 'busy' | 'away' | 'unknown';
export type Language = 'ar' | 'en';

export interface Palette {
  /** Screen background (Wall / Night wall). */
  bg: string;
  /** Cards, sheets, inputs (Plate / Night plate). */
  surface: string;
  /** Body text (Ink / Chalk). */
  text: string;
  /** Secondary text: captions, "updated 3 min ago" (Graphite / Slate). */
  muted: string;
  /** Actions, links and focus rings (Corridor blue / Lit blue). */
  primary: string;
  /** Text and icons placed on the primary colour. */
  onPrimary: string;
  /** Hairlines and input borders (Rule / Night rule). */
  line: string;
  /** Warm light inside an open door; decorative only. */
  lamp: string;
  /** Destructive actions (cancel appointment, decline): the busy red, tuned to 4.5:1 for text. */
  danger: string;
  /** Dims the screen behind sheets and dialogs. */
  scrim: string;
  /** Status colours: always paired with the door icon and a text label. */
  status: Record<StatusKey, string>;
}

export const palettes: Record<ColorScheme, Palette> = {
  light: {
    bg: '#F2F5F8',
    surface: '#FFFFFF',
    text: '#15212E',
    muted: '#4B5A69',
    primary: '#1F4F8C',
    onPrimary: '#FFFFFF',
    line: '#D6DEE6',
    lamp: '#FFE9A8',
    danger: '#9F1F1A',
    scrim: 'rgba(21, 33, 46, 0.45)',
    status: {
      in_office: '#178C55',
      in_class: '#B06C00',
      busy: '#9F1F1A',
      away: '#66727F',
      unknown: '#66727F',
    },
  },
  dark: {
    bg: '#0D151E',
    surface: '#152030',
    text: '#E7EEF5',
    muted: '#A3B2C2',
    primary: '#8AB6EE',
    onPrimary: '#0D151E',
    line: '#263445',
    lamp: '#F6D985',
    // Lighter than the busy status red: as text it needs 4.5:1 (5.4:1 here; #E8524C is 4.48:1).
    danger: '#F06A64',
    scrim: 'rgba(0, 0, 0, 0.55)',
    status: {
      in_office: '#63D69A',
      in_class: '#F2B544',
      busy: '#E8524C',
      away: '#94A2B1',
      unknown: '#94A2B1',
    },
  },
};

/** 4-unit spacing scale (DESIGN.md 4.3). */
export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64 } as const;

/** Radius by hierarchy (DESIGN.md Section 3). */
export const radii = { sheet: 20, card: 14, input: 10, pill: 999 } as const;

/** Minimum touch target (dp / px), and the cap on system font scaling (200%). */
export const touchTarget = 48;
export const maxFontScale = 2;

/** Motion durations in ms (DESIGN.md Section 5). */
export const durations = {
  press: 120,
  small: 200,
  doorOpen: 320,
  doorClose: 300,
  sheet: 350,
  reducedFade: 150,
} as const;
export const pressScale = 0.97;

/** IBM Plex Sans Arabic + IBM Plex Sans, by UI language and weight. */
export const fontFamilies: Record<Language, Record<'regular' | 'medium' | 'semibold', string>> = {
  ar: {
    regular: 'IBMPlexSansArabic_400Regular',
    medium: 'IBMPlexSansArabic_500Medium',
    semibold: 'IBMPlexSansArabic_600SemiBold',
  },
  en: {
    regular: 'IBMPlexSans_400Regular',
    medium: 'IBMPlexSans_500Medium',
    semibold: 'IBMPlexSans_600SemiBold',
  },
};

export type TextVariant = 'caption' | 'label' | 'body' | 'title' | 'heading' | 'display';

/** Mobile type scale (DESIGN.md 4.2); headings step up one level on the desktop web layout. */
export const typeScale: Record<
  TextVariant,
  { size: number; desktopSize: number; weight: 'regular' | 'medium' | 'semibold' }
> = {
  caption: { size: 13, desktopSize: 13, weight: 'regular' },
  label: { size: 15, desktopSize: 15, weight: 'medium' },
  body: { size: 17, desktopSize: 17, weight: 'regular' },
  title: { size: 20, desktopSize: 24, weight: 'semibold' },
  heading: { size: 24, desktopSize: 30, weight: 'semibold' },
  display: { size: 30, desktopSize: 30, weight: 'semibold' },
};

/** Line height multipliers: Arabic needs more room for marks above and below the line. */
export const lineHeightRatio: Record<Language, number> = { ar: 1.7, en: 1.5 };

/** Desktop web layout starts here (side rail, two panes, larger headings). */
export const desktopBreakpoint = 1024;

/** Floating layers only (sheets, menus, toasts); everything else uses surface contrast + hairlines. */
export const elevation: Record<ColorScheme, { floating: string }> = {
  light: { floating: '0px 8px 24px rgba(21, 33, 46, 0.16)' },
  dark: { floating: '0px 8px 24px rgba(0, 0, 0, 0.5)' },
};
