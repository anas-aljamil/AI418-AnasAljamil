import { useState, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';

import { textAlignFor } from '@/lib/direction';
import { useSettings } from '@/settings/SettingsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import {
  fontFamilies,
  lineHeightRatio,
  maxFontScale,
  radii,
  space,
  touchTarget,
  typeScale,
} from '@/theme/tokens';
import { Text } from './Text';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  /** Lets a form move focus to this field (e.g. the return key on the field before). */
  ref?: Ref<TextInput>;
  /** Always visible above the input (never a placeholder-only label). */
  label: string;
  helper?: string;
  error?: string;
  /** Shows "n/max" under the field. */
  maxLength?: number;
  counterLabel?: (count: number) => string;
}

export function TextField({
  label,
  helper,
  error,
  maxLength,
  counterLabel,
  value,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const { colors } = useTheme();
  const { i18n } = useTranslation();
  const [focused, setFocused] = useState(false);
  const language = i18n.language === 'ar' ? 'ar' : 'en';
  const { textScale } = useSettings();
  const body = { size: typeScale.body.size * textScale };
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.line;

  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? helper}
        aria-invalid={!!error}
        value={value}
        maxLength={maxLength}
        maxFontSizeMultiplier={maxFontScale / textScale}
        placeholderTextColor={colors.muted}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            borderColor,
            borderWidth: focused || error ? 2 : 1,
            backgroundColor: colors.surface,
            color: colors.text,
            fontFamily: fontFamilies[language].regular,
            fontSize: body.size,
            lineHeight: Math.round(body.size * lineHeightRatio[language]),
            textAlign: textAlignFor('start', language),
          },
        ]}
        {...rest}
      />
      <View style={styles.below}>
        <Text variant="caption" color={error ? 'danger' : 'muted'} style={styles.message}>
          {error ?? helper ?? ''}
        </Text>
        {maxLength != null && (
          <Text variant="caption" color="muted">
            {counterLabel ? counterLabel(value?.length ?? 0) : `${value?.length ?? 0}/${maxLength}`}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xxs },
  input: {
    minHeight: touchTarget,
    borderRadius: radii.input,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  below: { flexDirection: 'row', justifyContent: 'space-between', gap: space.xs },
  message: { flex: 1 },
});
