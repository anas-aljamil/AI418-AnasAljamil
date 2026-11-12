/**
 * When a schedule item happens (owner request 2026-11-11: a calendar and a repeating week):
 * every week on the chosen days, every week until a last date, or once on one date. Dates are
 * picked on a calendar a month at a time. A saved weekly item can also leave out single dates
 * (SkipDates), e.g. a holiday, which the API stores as skipped dates.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { useSkipDate, type RangeKind } from '@/api/queries';
import type { Repeats } from '@/api/types';
import { Button } from '@/components/Button';
import { Calendar } from '@/components/Calendar';
import { Chip } from '@/components/Chip';
import { MenuPicker } from '@/components/MenuPicker';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { addDays, dateText, occursOn, shortDateText, todayKey, weekdayOf } from '@/lib/dates';
import { errorKey } from '@/lib/errors';
import { daysText } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { space } from '@/theme/tokens';
import { DayChips, saveEachDay } from './days';

export type Repeat = 'weekly' | 'until' | 'once';
const REPEATS: Repeat[] = ['weekly', 'until', 'once'];
const WORKING_DAYS = [0, 1, 2, 3, 4];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
/** How far ahead dates can be picked. */
const AHEAD_DAYS = 365;

export interface WhenDraft {
  repeat: Repeat;
  days: number[];
  on_date: string | null;
  ends_on: string | null;
}

/** The API's when-fields for one saved item. */
export type WhenFields = Pick<Repeats, 'day_of_week' | 'on_date' | 'ends_on'>;

export function whenOf(row: Pick<Repeats, 'day_of_week' | 'on_date' | 'ends_on'>): WhenDraft {
  return {
    repeat: row.on_date ? 'once' : row.ends_on ? 'until' : 'weekly',
    days:
      row.day_of_week !== null ? [row.day_of_week] : row.on_date ? [weekdayOf(row.on_date)] : [],
    on_date: row.on_date,
    ends_on: row.ends_on,
  };
}

/** What is missing before saving, as an i18n key. */
export function whenError(draft: WhenDraft): string | undefined {
  if (draft.repeat === 'once') return draft.on_date ? undefined : 'schedule.date_missing';
  if (draft.days.length === 0) return 'schedule.days_missing';
  if (draft.repeat === 'until' && !draft.ends_on) return 'schedule.end_missing';
  return undefined;
}

/** "Sunday to Thursday, 10:00 AM–12:00 PM", "... until 31 December", "Thursday 8 October, ...". */
export function whenLine(draft: WhenDraft, range: string, t: TFunction): string {
  if (draft.repeat === 'once' && draft.on_date)
    return t('schedule.date_line', { date: dateText(draft.on_date, t), range });
  if (draft.repeat === 'until' && draft.ends_on)
    return t('schedule.day_line_until', {
      day: daysText(draft.days, t),
      range,
      date: shortDateText(draft.ends_on, t),
    });
  return t('schedule.day_line', { day: daysText(draft.days, t), range });
}

/**
 * Saves an item: once on its date, or one weekly item per chosen day (saveEachDay reports the
 * days that failed). `failed` holds the days still to save.
 */
export async function saveWhen(
  draft: WhenDraft,
  saveOne: (when: WhenFields) => Promise<unknown>,
  t: TFunction,
): Promise<{ saved: number[]; failed: number[]; message: string | null }> {
  if (draft.repeat === 'once') {
    try {
      await saveOne({ day_of_week: null, on_date: draft.on_date, ends_on: null });
      return { saved: draft.days, failed: [], message: null };
    } catch (error) {
      return { saved: [], failed: draft.days, message: t(errorKey(error)) };
    }
  }
  return saveEachDay(
    draft.days,
    (day) =>
      saveOne({
        day_of_week: day,
        on_date: null,
        ends_on: draft.repeat === 'until' ? draft.ends_on : null,
      }),
    t,
  );
}

interface WhenPickerProps {
  value: WhenDraft;
  onChange: (value: WhenDraft) => void;
  /** Working days only (timetable, booking times), or the whole week (closed hours). */
  workingDays: boolean;
  /** A new item may go on several days at once. */
  multiple: boolean;
  showErrors: boolean;
}

export function WhenPicker({
  value,
  onChange,
  workingDays,
  multiple,
  showErrors,
}: WhenPickerProps) {
  const { t } = useTranslation();
  const today = todayKey(useNow(60_000));
  const last = addDays(today, AHEAD_DAYS);
  const error = showErrors ? whenError(value) : undefined;
  const weekdays = workingDays ? WORKING_DAYS : ALL_DAYS;
  // The first day that can be picked for a dated item: today, or the next working day.
  let firstDay = today;
  while (!weekdays.includes(weekdayOf(firstDay))) firstDay = addDays(firstDay, 1);

  return (
    <View style={styles.wrap}>
      <MenuPicker
        label={t('schedule.repeat')}
        value={value.repeat}
        onChange={(chosen) => {
          const repeat = chosen as Repeat;
          onChange({
            ...value,
            repeat,
            on_date: repeat === 'once' ? (value.on_date ?? firstDay) : null,
            ends_on: repeat === 'until' ? value.ends_on : null,
          });
        }}
        placeholder={t('schedule.repeat_weekly')}
        options={REPEATS.map((repeat) => ({
          value: repeat,
          label: t(`schedule.repeat_${repeat}`),
        }))}
      />
      {value.repeat !== 'once' ? (
        <DayChips
          days={weekdays}
          value={value.days}
          onChange={(days) => onChange({ ...value, days })}
          multiple={multiple}
          error={error === 'schedule.days_missing' ? t(error) : undefined}
        />
      ) : null}
      {value.repeat === 'until' ? (
        <View style={styles.wrap}>
          <Text variant="label" role="heading">
            {t('schedule.last_date')}
          </Text>
          <Calendar
            label={t('schedule.last_date')}
            value={value.ends_on}
            onChange={(ends_on) => onChange({ ...value, ends_on })}
            from={today}
            to={last}
            today={today}
            weekdays={ALL_DAYS}
            paged
          />
        </View>
      ) : null}
      {value.repeat === 'once' ? (
        <View style={styles.wrap}>
          <Text variant="label" role="heading">
            {t('schedule.on_date')}
          </Text>
          <Calendar
            label={t('schedule.on_date')}
            value={value.on_date}
            onChange={(on_date) => onChange({ ...value, on_date, days: [weekdayOf(on_date)] })}
            from={today}
            to={last}
            today={today}
            weekdays={weekdays}
            paged
          />
        </View>
      ) : null}
      {error && error !== 'schedule.days_missing' ? (
        <Text variant="caption" color="danger">
          {t(error)}
        </Text>
      ) : null}
    </View>
  );
}

interface SkipDatesProps {
  path: 'schedule' | RangeKind;
  id: number;
  /** The saved weekly item, with its current skipped dates. */
  row: Repeats;
}

/** Dates a saved weekly item leaves out: each can be brought back; "Leave out a date" adds one. */
export function SkipDates({ path, id, row }: SkipDatesProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const skip = useSkipDate(path);
  const today = todayKey(useNow(60_000));
  const [picking, setPicking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const upcoming = row.skipped_dates.filter((date) => date >= today);
  const last =
    row.ends_on && row.ends_on < addDays(today, AHEAD_DAYS)
      ? row.ends_on
      : addDays(today, AHEAD_DAYS);

  const change = (date: string, leaveOut: boolean) => {
    setMessage(null);
    skip.mutate(
      { id, date, skip: leaveOut },
      {
        onSuccess: () => {
          setPicking(false);
          toast(
            t(leaveOut ? 'schedule.date_left_out' : 'schedule.date_back', {
              date: shortDateText(date, t),
            }),
          );
        },
        onError: (error) => setMessage(t(errorKey(error))),
      },
    );
  };

  return (
    <View style={styles.wrap}>
      <Text variant="label" role="heading">
        {t('schedule.skips_heading')}
      </Text>
      {upcoming.length ? (
        <View style={styles.row}>
          {upcoming.map((date) => (
            <Chip
              key={date}
              label={shortDateText(date, t)}
              accessibilityLabel={t('schedule.bring_back', { date: dateText(date, t) })}
              onPress={() => change(date, false)}
            />
          ))}
        </View>
      ) : (
        <Text variant="caption" color="muted">
          {t('schedule.skips_none')}
        </Text>
      )}
      {picking ? (
        <Calendar
          label={t('schedule.leave_out')}
          value={null}
          onChange={(date) => change(date, true)}
          from={today}
          to={last}
          today={today}
          weekdays={ALL_DAYS}
          enabled={(date) => occursOn(row, date)}
          paged
        />
      ) : null}
      <View style={styles.start}>
        <Button
          variant="quiet"
          label={picking ? t('common.cancel') : t('schedule.leave_out')}
          onPress={() => setPicking(!picking)}
          disabled={skip.isPending}
        />
      </View>
      <View accessibilityLiveRegion="polite" role={message ? 'alert' : undefined}>
        {message ? <Text color="danger">{message}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  start: { alignItems: 'flex-start' },
});
