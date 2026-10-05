import { Text as RNText, useWindowDimensions, type TextProps as RNTextProps } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme/ThemeProvider';
import {
  desktopBreakpoint,
  fontFamilies,
  lineHeightRatio,
  maxFontScale,
  typeScale,
  type Language,
  type TextVariant,
} from '@/theme/tokens';

type ColorToken = 'text' | 'muted' | 'primary' | 'onPrimary' | 'danger';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: ColorToken;
  /** Script of the content when it differs from the UI language (e.g. an Arabic name in English UI). */
  lang?: Language;
  /** Override the variant's weight (e.g. list-row names: body size, semibold). */
  weight?: 'regular' | 'medium' | 'semibold';
}

/**
 * All app text. Picks the IBM Plex family and line height for the script
 * (Arabic 1.7, Latin 1.5), steps headings up on the desktop layout, follows
 * the system font size up to 200%, and aligns to the reading direction.
 */
export function Text({
  variant = 'body',
  color = 'text',
  lang,
  weight,
  style,
  ...rest
}: TextProps) {
  const { colors } = useTheme();
  const { i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const language: Language = lang ?? (i18n.language === 'ar' ? 'ar' : 'en');
  const spec = typeScale[variant];
  const size = width >= desktopBreakpoint ? spec.desktopSize : spec.size;
  return (
    <RNText
      maxFontSizeMultiplier={maxFontScale}
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
