/**
 * One choice from a longer list (an office, a booking start, a length): a field that shows
 * the choice and opens the options.
 * - Phones and tablets in the browser (a touch screen) get the browser's own menu: a native
 *   <select> laid over the field, which the phone shows as its system picker (owner request
 *   2026-11-11).
 * - A computer (mouse) and the Expo Go app get our own menu, styled like the rest of the app:
 *   a sheet (a centred dialog on desktop) with the options as a radio list, or as compact pills
 *   for short labels such as times. Chrome's own menu on a computer could not be styled and
 *   broke the Arabic times over two lines (owner report 2026-11-11).
 * Options may be grouped under headings and may be unavailable: those stay in the list,
 * dimmed, and cannot be chosen; their label says why. Departments use DepartmentPicker.
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
  /** Short labels (times, lengths): our menu shows them as pills in rows instead of a list. */
  compact?: boolean;
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

/** A browser on a touch screen (phone or tablet), where the system picker fits best. */
function touchBrowser(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

export function MenuPicker({
  label,
  options,
  value,
  onChange,
  placeholder,
  error,
  compact = false,
}: MenuPickerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [native] = useState(touchBrowser);
  const selected = options.find((o) => o.value === value);
  const shown = selected?.label ?? placeholder;
  const runs = grouped(options);

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
      {native ? (
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
          aria-haspopup="dialog"
          onPress={() => setOpen(true)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
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

      {native ? null : (
        <BottomSheet visible={open} title={label} onClose={() => setOpen(false)}>
          <View role="radiogroup" accessibilityLabel={label} style={styles.groups}>
            {runs.map((run, index) => (
              <View key={index} style={styles.group}>
                {run.group === undefined ? null : (
                  <Text variant="label" weight="semibold" role="heading" color="muted">
                    {run.group}
                  </Text>
                )}
                <View style={compact ? styles.pills : styles.list}>
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
                        style={(state) => {
                          const keyboard =
                            'focused' in state && (state as { focused?: boolean }).focused;
                          return [
                            compact ? styles.pill : styles.option,
                            {
                              borderColor: chosen ? colors.primary : colors.line,
                              borderWidth: chosen ? 2 : 1,
                              backgroundColor: chosen
                                ? colors.primary
                                : state.pressed
                                  ? colors.line
                                  : colors.surface,
                              opacity: option.disabled ? 0.45 : 1,
                            },
                            keyboard && {
                              outlineColor: colors.primary,
                              outlineWidth: 2,
                              outlineStyle: 'solid',
                              outlineOffset: 2,
                            },
                          ];
                        }}
                      >
                        <Text
                          style={compact ? undefined : styles.grow}
                          numberOfLines={compact ? 1 : 2}
                          weight={chosen ? 'semibold' : 'regular'}
                          color={chosen ? 'onPrimary' : 'text'}
                        >
                          {option.label}
                        </Text>
                        {chosen && !compact ? (
                          <Check color={colors.onPrimary} size={20} strokeWidth={2} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
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
  groups: { gap: space.md },
  group: { gap: space.xs },
  list: { gap: space.xxs },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  option: {
    minHeight: touchTarget,
    borderRadius: radii.input,
    paddingHorizontal: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  pill: {
    minHeight: touchTarget,
    minWidth: touchTarget * 2,
    borderRadius: radii.pill,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
