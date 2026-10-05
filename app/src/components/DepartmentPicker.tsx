/**
 * Choosing a department from a menu grouped by college (owner request): the field shows the
 * choice; tapping it opens a sheet with each college as a heading and its departments as a
 * radio list, in the UI language's alphabetical order. Used by sign-up, the admin forms and
 * the Search filter (which adds "All departments", value null).
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';

import type { Department } from '@/api/types';
import { departmentName, spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, space, touchTarget, type Language } from '@/theme/tokens';
import { BottomSheet } from './BottomSheet';
import { Text } from './Text';

interface DepartmentPickerProps {
  label: string;
  departments: Department[];
  value: number | null;
  onChange: (departmentId: number | null) => void;
  /** Offer "All departments" (value null) first, for filters. */
  allLabel?: string;
  error?: string;
}

export function DepartmentPicker({
  label,
  departments,
  value,
  onChange,
  allLabel,
  error,
}: DepartmentPickerProps) {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => groupByCollege(departments, language), [departments, language]);
  const selected = departments.find((d) => d.department_id === value);
  const shown = selected
    ? departmentName(selected, language)
    : (allLabel ?? t('department_picker.choose'));

  const choose = (id: number | null) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <Pressable
        role="button"
        accessibilityLabel={spokenList([label, shown], t)}
        accessibilityHint={error ?? t('department_picker.hint')}
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
        <Text style={styles.grow} color={selected || allLabel ? 'text' : 'muted'} numberOfLines={2}>
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
          {allLabel ? (
            <Option label={allLabel} selected={value === null} onPress={() => choose(null)} />
          ) : null}
          {groups.map((group) => (
            <View key={group.key} style={styles.group}>
              <Text variant="caption" color="muted" weight="semibold" role="heading">
                {group.title}
              </Text>
              {group.departments.map((d) => (
                <Option
                  key={d.department_id}
                  label={departmentName(d, language)}
                  selected={d.department_id === value}
                  onPress={() => choose(d.department_id)}
                />
              ))}
            </View>
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

function Option({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      role="radio"
      aria-checked={selected}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          borderColor: selected ? colors.primary : colors.line,
          backgroundColor: selected ? colors.surface : 'transparent',
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={styles.grow} weight={selected ? 'semibold' : 'regular'}>
        {label}
      </Text>
      {selected ? <Check color={colors.primary} size={20} strokeWidth={2} /> : null}
    </Pressable>
  );
}

/** Colleges (by name) with their departments (by name), in the UI language. */
export function groupByCollege(departments: Department[], language: Language) {
  const byCollege = new Map<number, { key: number; title: string; departments: Department[] }>();
  for (const d of departments) {
    const group = byCollege.get(d.college.college_id) ?? {
      key: d.college.college_id,
      title: language === 'ar' ? d.college.name_ar : d.college.name_en,
      departments: [],
    };
    group.departments.push(d);
    byCollege.set(d.college.college_id, group);
  }
  const order = (a: string, b: string) => a.localeCompare(b, language);
  return [...byCollege.values()]
    .sort((a, b) => order(a.title, b.title))
    .map((g) => ({
      ...g,
      departments: [...g.departments].sort((a, b) =>
        order(departmentName(a, language), departmentName(b, language)),
      ),
    }));
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
  list: { gap: space.md },
  group: { gap: space.xxs },
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
