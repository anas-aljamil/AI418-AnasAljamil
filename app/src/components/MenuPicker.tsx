/**
 * One choice from a longer list (an office, a booking start): a field that shows the choice.
 * On phones it opens a sheet with the options as a radio list; on the web build it is the
 * browser's own menu (a native <select> laid over the field), which phones show as their
 * system picker list (owner request 2026-11-11). Options may be grouped under headings and
 * may be unavailable: those stay in the list, dimmed, and cannot be chosen; their label says
 * why. Shorter lists use chips; departments use DepartmentPicker, which groups them by college.
 */
import { createElement, Fragment, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';

import { spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, space, touchTarget, typeScale } from '@/theme/tokens';
import { BottomSheet } from './BottomSheet';
import { Text } from './Text';

export interface MenuOption {
  value: string;
  label: string;
  /** A heading the option sits under; consecutive options with the same group share it. */
  group?: string;
  /** Shown but not choosable. */
  disabled?: boolean;
}

interface MenuPickerProps {
  label: string;
  options: MenuOption[];
  value: string;
  onChange: (value: string) => void;
  /** Shown when nothing is chosen yet. */
  placeholder: string;
  error?: string;
}

/** Consecutive options with the same group, in order. */
function grouped(options: MenuOption[]): { group?: string; options: MenuOption[] }[] {
  const runs: { group?: string; options: MenuOption[] }[] = [];
  for (const option of options) {
    const last = runs[runs.length - 1];
    if (last && last.group === option.group) last.options.push(option);
    else runs.push({ group: option.group, options: [option] });
  }
  return runs;
}

export function MenuPicker({
  label,
  options,
  value,
  onChange,
  placeholder,
  error,
}: MenuPickerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const selected = options.find((o) => o.value === value);
  const shown = selected?.label ?? placeholder;
  const runs = grouped(options);
  const web = Platform.OS === 'web';

  const box = [
    styles.box,
    {
      borderColor: error ? colors.danger : focused ? colors.primary : colors.line,
      borderWidth: error || focused ? 2 : 1,
      backgroundColor: colors.surface,
    },
  ];
  const content = (
    <>
      <Text style={styles.grow} color={selected ? 'text' : 'muted'} numberOfLines={2}>
        {shown}
      </Text>
      <ChevronDown color={colors.muted} size={20} strokeWidth={1.75} />
    </>
  );

  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      {web ? (
        <View>
          {/* The visible field; the transparent <select> on top takes the taps, the keyboard
              and the screen reader, so the field itself is hidden from assistive technology. */}
          <View aria-hidden style={box}>
            {content}
          </View>
          {createElement(
            'select',
            {
              'aria-label': label,
              'aria-invalid': !!error,
              'aria-description': error,
              value: selected ? value : '',
              onChange: (event: { target: { value: string } }) => onChange(event.target.value),
              onFocus: () => setFocused(true),
              onBlur: () => setFocused(false),
              // 16 px or more stops iOS Safari from zooming the page when the menu opens.
              style: { ...webSelect, fontSize: typeScale.body.size },
            },
            selected ? null : (
              <option value="" disabled>
                {placeholder}
              </option>
            ),
            runs.map((run, index) =>
              run.group === undefined ? (
                <Fragment key={index}>{run.options.map(webOption)}</Fragment>
              ) : (
                <optgroup key={index} label={run.group}>
                  {run.options.map(webOption)}
                </optgroup>
              ),
            ),
          )}
        </View>
      ) : (
        <Pressable
          role="button"
          accessibilityLabel={spokenList([label, shown], t)}
          accessibilityHint={error}
          aria-invalid={!!error}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [box, { opacity: pressed ? 0.85 : 1 }]}
        >
          {content}
        </Pressable>
      )}
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}

      {web ? null : (
        <BottomSheet visible={open} title={label} onClose={() => setOpen(false)}>
          <View role="radiogroup" accessibilityLabel={label} style={styles.list}>
            {runs.map((run, index) => (
              <View key={index} style={styles.list}>
                {run.group === undefined ? null : (
                  <Text variant="label" weight="semibold" role="heading" style={styles.group}>
                    {run.group}
                  </Text>
                )}
                {run.options.map((option) => {
                  const chosen = option.value === value;
                  return (
                    <Pressable
                      key={option.value}
                      role="radio"
                      aria-checked={chosen}
                      aria-disabled={!!option.disabled}
                      disabled={option.disabled}
                      accessibilityLabel={option.label}
                      onPress={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.option,
                        {
                          borderColor: chosen ? colors.primary : colors.line,
                          backgroundColor: chosen ? colors.surface : 'transparent',
                          opacity: option.disabled ? 0.45 : pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Text style={styles.grow} weight={chosen ? 'semibold' : 'regular'}>
                        {option.label}
                      </Text>
                      {chosen ? <Check color={colors.primary} size={20} strokeWidth={2} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </BottomSheet>
      )}
    </View>
  );
}

function webOption(option: MenuOption) {
  return (
    <option key={option.value} value={option.value} disabled={option.disabled}>
      {option.label}
    </option>
  );
}

// Covers the visible field exactly and stays invisible; the browser draws its menu on tap.
const webSelect = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  cursor: 'pointer',
  margin: 0,
} as const;

const styles = StyleSheet.create({
  field: { gap: space.xxs },
  box: {
    minHeight: touchTarget,
    borderRadius: radii.input,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  grow: { flex: 1 },
  list: { gap: space.xxs },
  group: { paddingTop: space.xs },
  option: {
    minHeight: touchTarget,
    borderRadius: radii.input,
    borderWidth: 1,
    paddingHorizontal: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
});
