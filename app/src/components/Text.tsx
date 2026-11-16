import { Text as RNText, useWindowDimensions, type TextProps as RNTextProps } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useSettings } from '@/settings/SettingsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import {
  desktopBreakpoint,
  fontFamilies,
  lineHeightRatio,
  maxFontScale,
  typeScale,
  type FontWeight,
  type Language,
  type TextVariant,
} from '@/theme/tokens';

type ColorToken = 'text' | 'muted' | 'primary' | 'onPrimary' | 'danger' | 'onBand' | 'onBandMuted';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: ColorToken;
  /** Script of the content when it differs from the UI language (e.g. an Arabic name in English UI). */
  lang?: Language;
  /** Override the variant's weight (e.g. list-row names: body size, semibold). */
  weight?: FontWeight;
  /** Follow the app's text-size setting (off for the tab bar, which has its own cap). */
  appScale?: boolean;
}

/**
 * All app text. Picks the IBM Plex family and line height for the script
 * (Arabic 1.7, Latin 1.5), steps headings up on the desktop layout, follows
 * the system font size and the app's text-size setting up to 200% together, and aligns to
 * the reading direction.
 */
export function Text({
  variant = 'body',
  color = 'text',
  lang,
  weight,
  appScale = true,
  maxFontSizeMultiplier,
  style,
  ...rest
}: TextProps) {
  const { colors } = useTheme();
  const { i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const language: Language = lang ?? (i18n.language === 'ar' ? 'ar' : 'en');
  const { textScale } = useSettings();
  const scale = appScale ? textScale : 1;
  const spec = typeScale[variant];
  const size = (width >= desktopBreakpoint ? spec.desktopSize : spec.size) * scale;
  // A heading gets a level for screen readers: 1 for the screen's own heading (the two largest
  // sizes), 2 for a section's. `aria-level` on the call overrides it. React Native's types do
  // not list aria-level; React Native Web passes it on.
  const level =
    rest.role === 'heading' && !('aria-level' in rest)
      ? ({ 'aria-level': variant === 'heading' || variant === 'display' ? 1 : 2 } as object)
      : null;
  return (
    <RNText
      {...level}
      // The app setting and the phone's font size together stay at or under 200%.
      maxFontSizeMultiplier={(maxFontSizeMultiplier ?? maxFontScale) / scale}
      style={[
        {
          fontFamily: fontFamilies[language][weight ?? spec.weight],
          fontSize: size,
          lineHeight: Math.round(size * lineHeightRatio[language]),
          color: colors[color],
          textAlign: 'auto',
          writingDirection: language === 'ar' ? 'rtl' : 'ltr',
        },
        style,
      ]}
      {...rest}
    />
  );
}
