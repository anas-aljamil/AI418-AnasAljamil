/**
 * Design tokens: the single source for colour, type, space, shape, elevation and motion.
 * Values come from docs/DESIGN.md Section 11 ("The corridor", owner choice 2026-11-15: a navy
 * band of tall lit doors on a pale wall; the status colours are those of Direction A).
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
  /** Actions, links and focus rings (Door blue / Lit blue). */
  primary: string;
  /** Text and icons placed on the primary colour. */
  onPrimary: string;
  /** A quiet fill in the primary hue: the pill behind the current tab's icon. */
  tint: string;
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
  /**
   * The corridor: the navy band behind the tall doors and the desktop side rail. It is dark in
   * both themes, so it has its own text colours and its own status colours.
   */
  band: string;
  /** The current item on the band (the open tab in the side rail). */
  bandRaised: string;
  onBand: string;
  onBandMuted: string;
  /** The floor line under the corridor's doors, and hairlines on the band. */
  bandLine: string;
  /** Doors on the band (3:1 against it). */
  bandStatus: Record<StatusKey, string>;
  /** Status words on the band (4.5:1 against it). */
  bandStatusText: Record<StatusKey, string>;
}

/** Status colours on the band: the dark theme's, which were chosen for a dark ground. */
const BAND_STATUS: Record<StatusKey, string> = {
  in_office: '#63D69A',
  in_class: '#F2B544',
  busy: '#E8524C',
  away: '#94A2B1',
  unknown: '#94A2B1',
};
// As text the busy red needs 4.5:1; #E8524C reaches only 4.3:1 on the light theme's band.
const BAND_STATUS_TEXT: Record<StatusKey, string> = { ...BAND_STATUS, busy: '#F06A64' };

export const palettes: Record<ColorScheme, Palette> = {
  light: {
    bg: '#F1F4F8',
    surface: '#FFFFFF',
    text: '#101C2B',
    muted: '#4B5A69',
    primary: '#1B5BD0',
    onPrimary: '#FFFFFF',
    tint: '#E3ECFB',
    line: '#D6DEE6',
    lamp: '#FFD56B',
    danger: '#9F1F1A',
    scrim: 'rgba(16, 28, 43, 0.45)',
    // A little darker than the plan's #0F2747, so every colour-vision status keeps 3:1 on it.
    band: '#0E2441',
    bandRaised: '#1D3A63',
    onBand: '#FFFFFF',
    onBandMuted: '#B4C3D6',
    bandLine: '#3A5578',
    bandStatus: BAND_STATUS,
    bandStatusText: BAND_STATUS_TEXT,
    status: {
      in_office: '#178C55',
      in_class: '#B06C00',
      busy: '#9F1F1A',
      away: '#66727F',
      unknown: '#66727F',
    },
  },
  dark: {
    bg: '#0C1420',
    surface: '#141F2E',
    text: '#E8EEF6',
    muted: '#A3B2C2',
    primary: '#86B4FF',
    onPrimary: '#0C1420',
    tint: '#1C2E4A',
    line: '#263445',
    lamp: '#F8D572',
    // Lighter than the busy status red: as text it needs 4.5:1 (5.4:1 here; #E8524C is 4.48:1).
    danger: '#F06A64',
    scrim: 'rgba(0, 0, 0, 0.55)',
    band: '#060C15',
    bandRaised: '#16233A',
    onBand: '#E8EEF6',
    onBandMuted: '#A3B2C2',
    bandLine: '#2C3C52',
    bandStatus: BAND_STATUS,
    bandStatusText: BAND_STATUS_TEXT,
    status: {
      in_office: '#63D69A',
      in_class: '#F2B544',
      busy: '#E8524C',
      away: '#94A2B1',
      unknown: '#94A2B1',
    },
  },
};

/**
 * Colour vision (owner request 2026-11-11): the status colours for people who tell some
 * colours apart poorly. Chosen with scripts/check_palette.py: every colour keeps 3:1 on the
 * wall and the plate in its theme, and the four statuses stay at least delta E 22 apart under
 * the vision type they are for (greyscale: about 13, where the doors and labels carry it).
 * "normal" is the palette above.
 */
export type ColorVision = 'normal' | 'red_green' | 'blue_yellow' | 'none';
export const COLOR_VISIONS: ColorVision[] = ['normal', 'red_green', 'blue_yellow', 'none'];

type StatusColors = Record<StatusKey, string>;
const withAway = (scheme: ColorScheme, colors: Omit<StatusColors, 'away' | 'unknown'>) => ({
  ...colors,
  away: palettes[scheme].status.away,
  unknown: palettes[scheme].status.unknown,
});

export const visionStatus: Record<
  Exclude<ColorVision, 'normal'>,
  Record<ColorScheme, StatusColors>
> = {
  // Blue, amber and dark red: protanopia and deuteranopia keep them apart by lightness.
  red_green: {
    light: withAway('light', { in_office: '#16418F', in_class: '#C27A0A', busy: '#861317' }),
    dark: withAway('dark', { in_office: '#3D7DF5', in_class: '#F2B50D', busy: '#CC3333' }),
  },
  // Green, orange and raspberry: tritanopia keeps them apart.
  blue_yellow: {
    light: withAway('light', { in_office: '#1B7F4C', in_class: '#A35400', busy: '#B0124A' }),
    dark: withAway('dark', { in_office: '#5BD6A8', in_class: '#F2A65A', busy: '#FF6B8B' }),
  },
  // Shades of grey; "in office" has the most contrast.
  none: {
    light: withAway('light', { in_office: '#262626', in_class: '#454545', busy: '#8C8C8C' }),
    dark: withAway('dark', { in_office: '#E3E3E3', in_class: '#BABABA', busy: '#6E6E6E' }),
  },
};

/**
 * The palette for a theme and a colour vision. With a colour-vision setting the band's doors
 * take that setting's dark-theme colours, and the status words on the band are plain band
 * text: some of those colours pass 3:1 for a door but not 4.5:1 for words.
 */
export function paletteFor(scheme: ColorScheme, vision: ColorVision): Palette {
  const base = palettes[scheme];
  if (vision === 'normal') return base;
  const plain = { ...base.bandStatus };
  for (const key of Object.keys(plain) as StatusKey[]) plain[key] = base.onBand;
  return {
    ...base,
    status: visionStatus[vision][scheme],
    bandStatus: visionStatus[vision].dark,
    bandStatusText: plain,
  };
}

/** 4-unit spacing scale (DESIGN.md 4.3). */
export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64 } as const;

/** Radius by hierarchy (DESIGN.md Section 3). */
export const radii = { sheet: 20, card: 14, input: 10, pill: 999 } as const;

/**
 * Layout widths (docs/desktop-plan.md): phone below tabletMin, tablet up to desktopMin, then
 * desktop with the side rail and two panes. Columns cap line length (DESIGN.md 4.2).
 */
export const layout = {
  tabletMin: 768,
  desktopMin: 1024,
  tabletColumn: 720,
  column: 760,
  narrowColumn: 520,
  rail: 240,
  listPane: 380,
  dialog: 640,
  dialogHeight: 0.85,
} as const;

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

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';

/** IBM Plex Sans Arabic + IBM Plex Sans, by UI language and weight (bold: screen headings only). */
export const fontFamilies: Record<Language, Record<FontWeight, string>> = {
  ar: {
    regular: 'IBMPlexSansArabic_400Regular',
    medium: 'IBMPlexSansArabic_500Medium',
    semibold: 'IBMPlexSansArabic_600SemiBold',
    bold: 'IBMPlexSansArabic_700Bold',
  },
  en: {
    regular: 'IBMPlexSans_400Regular',
    medium: 'IBMPlexSans_500Medium',
    semibold: 'IBMPlexSans_600SemiBold',
    bold: 'IBMPlexSans_700Bold',
  },
};

export type TextVariant = 'caption' | 'label' | 'body' | 'title' | 'heading' | 'display';

/** Mobile type scale (DESIGN.md 4.2); headings step up one level on the desktop web layout. */
export const typeScale: Record<
  TextVariant,
  { size: number; desktopSize: number; weight: FontWeight }
> = {
  caption: { size: 13, desktopSize: 13, weight: 'regular' },
  label: { size: 15, desktopSize: 15, weight: 'medium' },
  body: { size: 17, desktopSize: 17, weight: 'regular' },
  title: { size: 20, desktopSize: 24, weight: 'semibold' },
  heading: { size: 24, desktopSize: 30, weight: 'bold' },
  display: { size: 30, desktopSize: 30, weight: 'bold' },
};

/** Line height multipliers: Arabic needs more room for marks above and below the line. */
export const lineHeightRatio: Record<Language, number> = { ar: 1.7, en: 1.5 };

/** Desktop web layout starts here (side rail, two panes, larger headings). */
export const desktopBreakpoint = layout.desktopMin;

/** Floating layers only (sheets, menus, toasts); everything else uses surface contrast + hairlines. */
export const elevation: Record<ColorScheme, { floating: string }> = {
  light: { floating: '0px 8px 24px rgba(16, 28, 43, 0.16)' },
  dark: { floating: '0px 8px 24px rgba(0, 0, 0, 0.5)' },
};
