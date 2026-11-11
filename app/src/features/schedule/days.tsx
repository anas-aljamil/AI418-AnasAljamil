/**
 * Days for the schedule sheets. A new item may go on several days at once (owner request
 * 2026-11-11: the same office hours from Sunday to Thursday took five trips through the
 * sheet); an item being edited keeps its one day. The API takes one day per item, so saving
 * sends one request per day and reports the days that failed without losing the others.
 */
import { StyleSheet, View } from 'react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/Chip';
import { Text } from '@/components/Text';
import { errorKey } from '@/lib/errors';
import { daysText } from '@/lib/format';
import { space } from '@/theme/tokens';

interface DayChipsProps {
  /** The days that can be chosen (0 = Sunday). */
  days: readonly number[];
  value: number[];
  onChange: (days: number[]) => void;
  /** Several days (a new item) or exactly one (an item being edited). */
  multiple: boolean;
  error?: string;
}

export function DayChips({ days, value, onChange, multiple, error }: DayChipsProps) {
  const { t } = useTranslation();
  const all = days.every((day) => value.includes(day));
  const toggle = (day: number) =>
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day]);

  return (
    <View style={styles.wrap}>
      <Text variant="label" role="heading">
        {t(multiple ? 'schedule.days' : 'schedule.day')}
      </Text>
      <View style={styles.row}>
        {multiple ? (
          <Chip
            label={daysText([...days], t)}
            selected={all}
            onPress={() => onChange(all ? [] : [...days])}
          />
        ) : null}
        {days.map((day) => (
          <Chip
            key={day}
            label={t(`weekday.${day}`)}
            selected={value.includes(day)}
            onPress={() => (multiple ? toggle(day) : onChange([day]))}
          />
        ))}
      </View>
      {error ? <Text color="danger">{error}</Text> : null}
    </View>
  );
}

/**
 * Saves one item per day, one after the other, and returns the days that failed with the
 * reason in the UI language ("Not saved for Tuesday: ...").
 */
export async function saveEachDay(
  days: number[],
  saveOne: (day: number) => Promise<unknown>,
  t: TFunction,
): Promise<{ saved: number[]; failed: number[]; message: string | null }> {
  const saved: number[] = [];
  const failed: number[] = [];
  const reasons: string[] = [];
  for (const day of [...days].sort((a, b) => a - b)) {
    try {
      await saveOne(day);
      saved.push(day);
    } catch (error) {
      failed.push(day);
      reasons.push(
        days.length === 1
          ? t(errorKey(error))
          : t('schedule.day_failed', { day: t(`weekday.${day}`), reason: t(errorKey(error)) }),
      );
    }
  }
  return { saved, failed, message: reasons.length ? reasons.join('\n') : null };
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
