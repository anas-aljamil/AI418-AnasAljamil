/**
 * A weekly time range on the 15-minute grid, picked as a start and a length, each from a
 * menu (owner request 2026-11-11, replacing the hour, minute and length chips: they took two
 * rows of 15-24 chips, nothing said the minutes were a second step, and ":00" read "00:" in
 * Arabic). The start menu lists every quarter hour under its hour; the length menu lists every
 * length that fits, each with its end ("1 hour 30 minutes, until 9:30 AM"). The end follows
 * from the two, so a range can never end before it starts.
 *
 * Values stay "HH:MM" on the 24-hour clock, as the API stores them.
 * - Same-day ranges (timetable, booking times) offer starts from 7 AM to 9:45 PM and end by
 *   11:45 PM.
 * - Overnight ranges (closed message hours) offer every start and may run past midnight, up to
 *   a whole day, which is stored as an end equal to the start.
 */
import { StyleSheet, View } from 'react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { clockText, durationText, hourText, minutesOfDay, timeOfDay } from '@/lib/format';
import { space } from '@/theme/tokens';
import { MenuPicker } from './MenuPicker';

const STEP = 15;
const DAY = 24 * 60;
/** The latest end of a same-day range (the API needs the end after the start, same day). */
const LAST_END = DAY - STEP;
const FIRST_WORK_START = 7 * 60;
const LAST_WORK_START = 21 * 60 + 45;

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

/** "2 hours, until 12:00 PM", "12 hours, until 8:00 AM the next day" or "All day". */
export function lengthText(start: number, length: number, t: TFunction): string {
  if (length === DAY) return t('schedule.whole_day');
  return t(start + length > DAY ? 'time_picker.until_next_day' : 'time_picker.until', {
    length: durationText(length, t),
    end: clockText(timeOfDay(start + length), t),
  });
}

export function TimeRangePicker({ value, onChange, overnight = false }: TimeRangePickerProps) {
  const { t } = useTranslation();
  const start = minutesOfDay(value.start_time);
  const length = rangeLength(value, overnight);
  const maxLength = (from: number) => (overnight ? DAY : LAST_END - from);

  const set = (nextStart: number, nextLength: number) => {
    const fitted = Math.max(STEP, Math.min(nextLength, maxLength(nextStart)));
    onChange({ start_time: timeOfDay(nextStart), end_time: timeOfDay(nextStart + fitted) });
  };

  // A start saved before outside 7 AM-9:45 PM still shows, so the current value is listed.
  const starts: number[] = [];
  for (let at = 0; at < DAY; at += STEP) {
    const inHours = overnight || (at >= FIRST_WORK_START && at <= LAST_WORK_START);
    if (inHours || at === start) starts.push(at);
  }
  const lengths: number[] = [];
  for (let option = STEP; option <= maxLength(start); option += STEP) lengths.push(option);

  return (
    <View style={styles.wrap}>
      <MenuPicker
        label={t('schedule.start')}
        compact
        value={String(start)}
        onChange={(chosen) => set(Number(chosen), length)}
        placeholder={clockText(value.start_time, t)}
        options={starts.map((at) => ({
          value: String(at),
          label: clockText(timeOfDay(at), t),
          group: hourText(Math.floor(at / 60), t),
        }))}
      />
      <MenuPicker
        label={t('time_picker.length')}
        value={String(length)}
        onChange={(chosen) => set(start, Number(chosen))}
        placeholder={lengthText(start, length, t)}
        options={lengths.map((option) => ({
          value: String(option),
          label: lengthText(start, option, t),
        }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
});
