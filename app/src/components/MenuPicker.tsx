/**
 * One choice from a longer list (e.g. an office): a field that shows the choice and opens a
 * sheet with the options as a radio list. Shorter lists use chips; departments use
 * DepartmentPicker, which groups them by college.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';

import { spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, space, touchTarget } from '@/theme/tokens';
import { BottomSheet } from './BottomSheet';
import { Text } from './Text';

interface MenuPickerProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  /** Shown when nothing is chosen yet. */
  placeholder: string;
  error?: string;
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
  const selected = options.find((o) => o.value === value);
  const shown = selected?.label ?? placeholder;

  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <Pressable
        role="button"
        accessibilityLabel={spokenList([label, shown], t)}
        accessibilityHint={error}
        aria-invalid={!!error}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.box,
          {
            borderColor: error ? colors.danger : colors.line,
            borderWidth: error ? 2 : 1,
            backgroundColor: colors.surface,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={styles.grow} color={selected ? 'text' : 'muted'} numberOfLines={2}>
          {shown}
        </Text>
        <ChevronDown color={colors.muted} size={20} strokeWidth={1.75} />
      </Pressable>
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}

      <BottomSheet visible={open} title={label} onClose={() => setOpen(false)}>
        <View role="radiogroup" accessibilityLabel={label} style={styles.list}>
          {options.map((option) => {
            const chosen = option.value === value;
            return (
              <Pressable
                key={option.value}
                role="radio"
                aria-checked={chosen}
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
                    opacity: pressed ? 0.85 : 1,
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
      </BottomSheet>
    </View>
  );
}

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
