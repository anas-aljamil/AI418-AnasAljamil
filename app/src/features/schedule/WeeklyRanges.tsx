/**
 * Weekly times that are not timetable blocks (owner decisions 2026-11-07), edited like the
 * timetable: a week view (WeekAgenda) and a sheet to add, change or delete one. A line at the
 * top says what holds now ("Students can book now, until 12:00 PM", "Messages are closed now,
 * until 8:00 AM tomorrow"); booking times also say whether they fall in office hours.
 * - Booking times (Sunday-Thursday): students can book only inside them, whether they fall in
 *   office hours or not. No booking times means nobody can book.
 * - Closed message hours (any day): students cannot write then. A length past midnight runs
 *   into the next day ("8:00 PM to 8:00 AM the next day"), and a whole day is stored as an
 *   end equal to the start. Overlaps are refused by the API.
 * Both are picked as days, a start and a length (TimeRangePicker); a new one may go on
 * several days at once.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import CalendarCheck from 'lucide-react-native/icons/calendar-check';
import Moon from 'lucide-react-native/icons/moon';
import Plus from 'lucide-react-native/icons/plus';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import {
  useDeleteRange,
  useMyRanges,
  useMySchedule,
  useSaveRange,
  type RangeInput,
  type RangeKind,
  type WeeklyRange,
} from '@/api/queries';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { SkeletonRow } from '@/components/Placeholders';
import { Text } from '@/components/Text';
import { TimeRangePicker, type TimeRange } from '@/components/TimeRangePicker';
import { useToast } from '@/components/Toast';
import { SectionError } from '@/features/home/HomeParts';
import { errorKey } from '@/lib/errors';
import { occursOn } from '@/lib/dates';
import { clockText, daysText, minutesOfDay, timeOfDay } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { WeekAgenda } from './WeekAgenda';
import {
  current,
  DAY,
  overlap,
  span,
  stretches,
  untilNext,
  weekMinute,
  type DatedRange,
} from './week';
import {
  saveWhen,
  SkipDates,
  whenError,
  whenLine,
  whenOf,
  WhenPicker,
  type WhenDraft,
} from './WhenPicker';

const WORKING_DAYS = [0, 1, 2, 3, 4];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Per kind: the days offered, and whether an end may come before the start. */
const KINDS = {
  'booking-periods': {
    days: WORKING_DAYS,
    overnight: false,
    defaults: { start_time: '10:00', end_time: '11:00' },
    keys: {
      intro: 'schedule.booking_intro',
      add: 'schedule.add_period',
      title: 'schedule.booking_time',
      newTitle: 'schedule.new_period_title',
      editTitle: 'schedule.edit_period_title',
      save: 'schedule.save_period',
      delete: 'schedule.delete_period',
      confirmTitle: 'schedule.confirm_delete_period_title',
      confirmBody: 'schedule.confirm_delete_period_body',
      saved: 'schedule.period_saved',
      deleted: 'schedule.period_deleted',
    },
  },
  'chat-closed-hours': {
    days: ALL_DAYS,
    overnight: true,
    defaults: { start_time: '20:00', end_time: '08:00' },
    keys: {
      intro: 'schedule.chat_intro',
      add: 'schedule.add_closure',
      title: 'schedule.closed_time',
      newTitle: 'schedule.new_closure_title',
      editTitle: 'schedule.edit_closure_title',
      save: 'schedule.save_closure',
      delete: 'schedule.delete_closure',
      confirmTitle: 'schedule.confirm_delete_closure_title',
      confirmBody: 'schedule.confirm_delete_closure_body',
      saved: 'schedule.closure_saved',
      deleted: 'schedule.closure_deleted',
    },
  },
} as const;

/** "10:00 AM–12:00 PM", "8:00 PM to 8:00 AM the next day", "4:00 PM until midnight", "All day". */
export function rangeLine(
  range: Pick<RangeInput, 'start_time' | 'end_time'>,
  t: TFunction,
): string {
  const start = minutesOfDay(range.start_time);
  const end = minutesOfDay(range.end_time);
  const times = { start: clockText(range.start_time, t), end: clockText(range.end_time, t) };
  if (start === end) return t('schedule.whole_day');
  if (end > start) return t('schedule.range_line', times);
  if (end === 0) return t('schedule.range_to_midnight', times);
  return t('schedule.range_overnight', times);
}

/**
 * "10:00 AM" ("today at 10:00 AM" with todayKey), "tomorrow at 8:00 AM" or "Sunday at 8:00 AM":
 * a week minute seen from `at`.
 */
export function atText(
  target: number,
  at: number,
  t: TFunction,
  todayKey = 'schedule.at_today',
): string {
  const time = clockText(timeOfDay(target % DAY), t);
  const days = Math.floor(target / DAY) - Math.floor(at / DAY);
  if (days === 0) return t(todayKey, { time });
  if (days === 1) return t('schedule.at_tomorrow', { time });
  return t('schedule.at_day', { day: t(`weekday.${Math.floor(target / DAY) % 7}`), time });
}

/**
 * What holds now for booking times or closed message hours, as one sentence. Looks at the
 * actual dates from yesterday to a week ahead (dated rows and skipped dates count).
 */
export function nowLine(kind: RangeKind, ranges: DatedRange[], now: Date, t: TFunction): string {
  const overnight = KINDS[kind].overnight;
  const at = weekMinute(now);
  const stretched = stretches(ranges, overnight, now);
  const live = current(stretched, at);
  const next = untilNext(stretched, at);
  if (kind === 'booking-periods') {
    if (ranges.length === 0) return t('schedule.booking_none');
    if (live) return t('schedule.booking_open_now', { when: atText(live.to, at, t) });
    if (next === null) return t('schedule.booking_later');
    return t('schedule.booking_next', {
      when: atText(at + next, at, t, 'schedule.today_at'),
    });
  }
  if (ranges.length === 0) return t('schedule.chat_always_open');
  if (live) return t('schedule.chat_closed_now', { when: atText(live.to, at, t) });
  if (next === null) return t('schedule.chat_open_plain');
  return t('schedule.chat_open_now', { when: atText(at + next, at, t) });
}

export function WeeklyRanges({ kind }: { kind: RangeKind }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const config = KINDS[kind];
  const ranges = useMyRanges(kind);
  // Booking times say whether they fall in office hours.
  const schedule = useMySchedule();
  const now = useNow(60_000);
  const [editing, setEditing] = useState<{ id: number | null; range: RangeInput } | null>(null);
  const booking = kind === 'booking-periods';

  // A weekly booking time is compared with the weekly office hours of its day, a dated one with
  // the office hours that happen on its date.
  const officeNote = (range: WeeklyRange): string | null => {
    if (!booking || !schedule.data) return null;
    const mine = span(range, false);
    const part = { from: mine.start, to: mine.start + mine.length };
    const inside = schedule.data
      .filter(
        (b) =>
          b.kind === 'office_hours' &&
          (range.on_date !== null
            ? occursOn(b, range.on_date)
            : b.on_date === null && b.day_of_week === range.day_of_week),
      )
      .reduce((sum, b) => {
        const theirs = span(b, false);
        return sum + overlap(part, { from: theirs.start, to: theirs.start + theirs.length });
      }, 0);
    if (inside === 0) return t('schedule.outside_office');
    return inside >= part.to - part.from
      ? t('schedule.inside_office')
      : t('schedule.partly_office');
  };

  return (
    <>
      <Text color="muted">{t(config.keys.intro)}</Text>
      {ranges.data ? (
        <Text weight="medium" accessibilityLiveRegion="polite">
          {nowLine(kind, ranges.data, now, t)}
        </Text>
      ) : null}
      <View style={styles.start}>
        <Button
          label={t(config.keys.add)}
          icon={<Plus color={colors.onPrimary} size={20} strokeWidth={2} />}
          onPress={() =>
            setEditing({
              id: null,
              range: {
                day_of_week: config.days[0] ?? 0,
                on_date: null,
                ends_on: null,
                ...config.defaults,
              },
            })
          }
        />
      </View>

      {ranges.data === undefined && !ranges.error ? (
        <SkeletonRow />
      ) : ranges.error ? (
        <SectionError message={t(errorKey(ranges.error))} onRetry={() => ranges.refetch()} />
      ) : (
        <WeekAgenda
          days={[...config.days]}
          overnight={config.overnight}
          overview
          items={(ranges.data ?? []).map((range) => ({
            key: String(range.id),
            range,
            title: t(config.keys.title),
            note: officeNote(range),
            color: booking ? colors.primary : colors.status.away,
            pattern: booking ? 'solid' : 'dashed',
            icon: booking ? (
              <CalendarCheck color={colors.primary} size={20} strokeWidth={1.75} />
            ) : (
              <Moon color={colors.muted} size={20} strokeWidth={1.75} />
            ),
            onPress: () => setEditing({ id: range.id, range }),
          }))}
        />
      )}

      {editing ? (
        <RangeSheet
          key={editing.id ?? 'new'}
          kind={kind}
          id={editing.id}
          initial={editing.range}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

interface RangeSheetProps {
  kind: RangeKind;
  id: number | null;
  initial: RangeInput;
  onClose: () => void;
}

function RangeSheet({ kind, id, initial, onClose }: RangeSheetProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const config = KINDS[kind];
  const save = useSaveRange(kind);
  const remove = useDeleteRange(kind);
  const [when, setWhen] = useState<WhenDraft>(whenOf(initial));
  // The saved item as the list has it now, for its skipped dates.
  const live = useMyRanges(kind).data?.find((r) => r.id === id);
  const [times, setTimes] = useState<TimeRange>({
    start_time: initial.start_time,
    end_time: initial.end_time,
  });
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const missing = whenError(when);
  const line = (draft: WhenDraft, range: TimeRange) => whenLine(draft, rangeLine(range, t), t);

  const submit = async () => {
    setShowErrors(true);
    if (missing) return;
    setServerError(null);
    setSaving(true);
    const result = await saveWhen(
      when,
      (fields) => save.mutateAsync({ id, range: { ...fields, ...times } }),
      t,
    );
    setSaving(false);
    if (result.failed.length === 0) {
      toast(t(config.keys.saved));
      onClose();
      return;
    }
    // Keep only the days that still need saving, so trying again does not add duplicates.
    if (result.saved.length > 0)
      toast(t('schedule.saved_for', { days: daysText(result.saved, t) }));
    setWhen({ ...when, days: result.failed });
    setServerError(result.message);
  };

  const confirmDelete = () => {
    if (id === null) return;
    remove.mutate(id, {
      onSuccess: () => {
        toast(t(config.keys.deleted));
        onClose();
      },
      onError: (error) => {
        setConfirming(false);
        setServerError(t(errorKey(error)));
      },
    });
  };

  return (
    <>
      <BottomSheet
        visible={!confirming}
        title={t(id === null ? config.keys.newTitle : config.keys.editTitle)}
        onClose={onClose}
      >
        <WhenPicker
          value={when}
          onChange={setWhen}
          workingDays={!config.overnight}
          multiple={id === null}
          showErrors={showErrors}
        />
        <TimeRangePicker value={times} onChange={setTimes} overnight={config.overnight} />
        {!missing ? (
          <Text weight="medium" accessibilityLiveRegion="polite">
            {line(when, times)}
          </Text>
        ) : null}
        <View accessibilityLiveRegion="polite" role={serverError ? 'alert' : undefined}>
          {serverError ? <Text color="danger">{serverError}</Text> : null}
        </View>
        <Button label={t(config.keys.save)} onPress={submit} disabled={saving} block />
        {id !== null && live && live.day_of_week !== null && when.repeat !== 'once' ? (
          <SkipDates path={kind} id={id} row={live} />
        ) : null}
        {id !== null ? (
          <Button
            variant="danger"
            label={t(config.keys.delete)}
            onPress={() => setConfirming(true)}
            block
          />
        ) : null}
      </BottomSheet>
      <ConfirmSheet
        visible={confirming}
        title={t(config.keys.confirmTitle)}
        body={t(config.keys.confirmBody, { line: line(whenOf(initial), initial) })}
        confirmLabel={t(config.keys.delete)}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(false)}
        busy={remove.isPending}
      />
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  start: { alignItems: 'flex-start' },
});
