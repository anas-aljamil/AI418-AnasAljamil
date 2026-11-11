/**
 * A weekly time range on the 15-minute grid, picked as a start and a length (owner request
 * 2026-11-11: the old start and end pickers were 36 chips and let the end fall before the
 * start). The start is one hour chip that carries its period ("10 AM", "10 ص") plus a minute
 * chip; the length is a stepper (15 minutes shorter or longer) and one-tap lengths. The end
 * follows from the two, so a range can never end before it starts.
 *
 * Values stay "HH:MM" on the 24-hour clock, as the API stores them.
 * - Same-day ranges (timetable, booking times) offer 7 AM to 9 PM and end by 11:45 PM.
 * - Overnight ranges (closed message hours) offer every hour and may run past midnight, up to
 *   a whole day, which is stored as an end equal to the start.
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { clockText, durationText, hourText, minutesOfDay, timeOfDay } from '@/lib/format';
import { space } from '@/theme/tokens';
import { Chip } from './Chip';
import { StepButton } from './StepButton';
import { Text } from './Text';

const STEP = 15;
const DAY = 24 * 60;
/** The latest end of a same-day range (the API needs the end after the start, same day). */
const LAST_END = DAY - STEP;
const WORK_HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7 AM to 9 PM
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];
const SAME_DAY_LENGTHS = [30, 60, 90, 120, 180];
const OVERNIGHT_LENGTHS = [60, 120, 240, 480, 720, DAY];

export interface TimeRange {
  start_time: string;
  end_time: string;
}

interface TimeRangePickerProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
  /** The range may run past midnight, up to a whole day (closed message hours). */
  overnight?: boolean;
}

/** The length of a range in minutes; overnight, an end at or before the start is the next day. */
export function rangeLength({ start_time, end_time }: TimeRange, overnight: boolean): number {
  const length = minutesOfDay(end_time) - minutesOfDay(start_time);
  if (overnight) return length > 0 ? length : length + DAY;
  return Math.max(STEP, length);
}

export function TimeRangePicker({ value, onChange, overnight = false }: TimeRangePickerProps) {
  const { t } = useTranslation();
  const start = minutesOfDay(value.start_time);
  const length = rangeLength(value, overnight);
  const startHour = Math.floor(start / 60);
  const maxLength = (from: number) => (overnight ? DAY : LAST_END - from);

  const set = (nextStart: number, nextLength: number) => {
    const fitted = Math.max(STEP, Math.min(nextLength, maxLength(nextStart)));
    onChange({ start_time: timeOfDay(nextStart), end_time: timeOfDay(nextStart + fitted) });
  };

  // An hour saved before outside 7 AM-9 PM still shows, so the current value is always visible.
  const hours = overnight
    ? ALL_HOURS
    : WORK_HOURS.includes(startHour)
      ? WORK_HOURS
      : [...WORK_HOURS, startHour].sort((a, b) => a - b);
  const lengths = (overnight ? OVERNIGHT_LENGTHS : SAME_DAY_LENGTHS).filter(
    (option) => option <= maxLength(start),
  );
  const startLabel = t('schedule.start');
  const lengthLabel = t('time_picker.length');
  const end = clockText(timeOfDay(start + length), t);
  const lengthLine =
    length === DAY
      ? t('schedule.whole_day')
      : t(start + length > DAY ? 'time_picker.until_next_day' : 'time_picker.until', {
          length: durationText(length, t),
          end,
        });

  return (
    <View style={styles.wrap}>
      <View style={styles.heading}>
        <Text variant="label" role="heading">
          {startLabel}
        </Text>
        <Text weight="semibold">{clockText(value.start_time, t)}</Text>
      </View>
      <View style={styles.row}>
        {hours.map((hour) => (
          <Chip
            key={hour}
            label={hourText(hour, t)}
            accessibilityLabel={t('time_picker.hour_label', {
              field: startLabel,
              hour: hourText(hour, t),
            })}
            selected={startHour === hour}
            onPress={() => set(hour * 60 + (start % 60), length)}
          />
        ))}
      </View>
      <View style={styles.row}>
        {MINUTES.map((minute) => (
          <Chip
            key={minute}
            label={`:${String(minute).padStart(2, '0')}`}
            accessibilityLabel={t('time_picker.minute_label', {
              field: startLabel,
              minute: String(minute).padStart(2, '0'),
            })}
            selected={start % 60 === minute}
            onPress={() => set(startHour * 60 + minute, length)}
          />
        ))}
      </View>

      <Text variant="label" role="heading" style={styles.gap}>
        {lengthLabel}
      </Text>
      <View style={styles.stepper}>
        <StepButton
          label={t('time_picker.shorter')}
          icon="minus"
          disabled={length <= STEP}
          onPress={() => set(start, length - STEP)}
        />
        <Text
          weight="semibold"
          style={[styles.grow, styles.center]}
          accessibilityLiveRegion="polite"
        >
          {lengthLine}
        </Text>
        <StepButton
          label={t('time_picker.longer')}
          icon="plus"
          disabled={length >= maxLength(start)}
          onPress={() => set(start, length + STEP)}
        />
      </View>
      <View style={styles.row}>
        {lengths.map((option) => {
          const text = option === DAY ? t('schedule.whole_day') : durationText(option, t);
          return (
            <Chip
              key={option}
              label={text}
              accessibilityLabel={t('time_picker.length_label', {
                field: lengthLabel,
                length: text,
              })}
              selected={length === option}
              onPress={() => set(start, option)}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  gap: { marginTop: space.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grow: { flex: 1 },
  center: { textAlign: 'center' },
});
