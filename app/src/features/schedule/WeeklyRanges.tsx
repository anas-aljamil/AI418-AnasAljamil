/**
 * Weekly times that are not timetable blocks (owner decisions 2026-11-07), edited like the
 * timetable: a list per day and a sheet to add, change or delete one.
 * - Booking times (Sunday-Thursday): students can book only inside them, whether they fall in
 *   office hours or not. No booking times means nobody can book.
 * - Closed message hours (any day): students cannot write then. An end at or before the start
 *   runs into the next day ("8:00 PM to 8:00 AM the next day"); the same time closes the
 *   whole day. Overlaps are refused by the API.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import {
  useDeleteRange,
  useMyRanges,
  useSaveRange,
  type RangeInput,
  type RangeKind,
  type WeeklyRange,
} from '@/api/queries';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { SkeletonRow } from '@/components/Placeholders';
import { ListRow } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { TimePicker } from '@/components/TimePicker';
import { useToast } from '@/components/Toast';
import { SectionError } from '@/features/home/HomeParts';
import { errorKey } from '@/lib/errors';
import { clockText, minutesOfDay } from '@/lib/format';
import { isQuarterHour } from '@/lib/validation';
import { space } from '@/theme/tokens';

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
      empty: 'schedule.no_periods',
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
      empty: 'schedule.no_closures',
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
export function rangeLine(range: RangeInput, t: TFunction): string {
  const start = minutesOfDay(range.start_time);
  const end = minutesOfDay(range.end_time);
  const times = { start: clockText(range.start_time, t), end: clockText(range.end_time, t) };
  if (start === end) return t('schedule.whole_day');
  if (end > start) return t('schedule.range_line', times);
  if (end === 0) return t('schedule.range_to_midnight', times);
  return t('schedule.range_overnight', times);
}

export function WeeklyRanges({ kind }: { kind: RangeKind }) {
  const { t } = useTranslation();
  const config = KINDS[kind];
  const ranges = useMyRanges(kind);
  const [editing, setEditing] = useState<{ id: number | null; range: RangeInput } | null>(null);

  return (
    <>
      <Text color="muted">{t(config.keys.intro)}</Text>
      <View style={styles.start}>
        <Button
          label={t(config.keys.add)}
          onPress={() =>
            setEditing({
              id: null,
              range: { day_of_week: config.days[0] ?? 0, ...config.defaults },
            })
          }
        />
      </View>

      {ranges.data === undefined && !ranges.error ? (
        <SkeletonRow />
      ) : ranges.error ? (
        <SectionError message={t(errorKey(ranges.error))} onRetry={() => ranges.refetch()} />
      ) : (
        <>
          {ranges.data?.length === 0 ? (
            <Text weight="medium" accessibilityLiveRegion="polite">
              {t(config.keys.empty)}
            </Text>
          ) : null}
          {config.days.map((day) => {
            const rows = (ranges.data ?? []).filter((r) => r.day_of_week === day);
            return (
              <View key={day} style={styles.section}>
                <Text variant="title" role="heading">
                  {t(`weekday.${day}`)}
                </Text>
                {rows.length === 0 ? (
                  <Text color="muted">{t('schedule.empty_day')}</Text>
                ) : (
                  rows.map((range: WeeklyRange) => (
                    <ListRow
                      key={range.id}
                      title={rangeLine(range, t)}
                      onPress={() => setEditing({ id: range.id, range })}
                    />
                  ))
                )}
              </View>
            );
          })}
        </>
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
  const [range, setRange] = useState<RangeInput>({
    day_of_week: initial.day_of_week,
    start_time: initial.start_time,
    end_time: initial.end_time,
  });
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const update = (patch: Partial<RangeInput>) => setRange((current) => ({ ...current, ...patch }));

  const startError = !isQuarterHour(range.start_time) ? t('schedule.time_invalid') : null;
  const endError = !isQuarterHour(range.end_time)
    ? t('schedule.time_invalid')
    : !config.overnight &&
        !startError &&
        minutesOfDay(range.end_time) <= minutesOfDay(range.start_time)
      ? t('schedule.end_before_start')
      : null;
  const line = (r: RangeInput) =>
    t('schedule.day_line', { day: t(`weekday.${r.day_of_week}`), range: rangeLine(r, t) });

  const submit = () => {
    setShowErrors(true);
    if (startError || endError) return;
    setServerError(null);
    save.mutate(
      { id, range },
      {
        onSuccess: () => {
          toast(t(config.keys.saved));
          onClose();
        },
        onError: (error) => setServerError(t(errorKey(error))),
      },
    );
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
        <Text variant="label" role="heading">
          {t('schedule.day')}
        </Text>
        <View style={styles.chips}>
          {config.days.map((day) => (
            <Chip
              key={day}
              label={t(`weekday.${day}`)}
              selected={range.day_of_week === day}
              onPress={() => update({ day_of_week: day })}
            />
          ))}
        </View>
        <TimePicker
          label={t('schedule.start')}
          value={range.start_time}
          onChange={(value) => update({ start_time: value })}
          error={showErrors ? (startError ?? undefined) : undefined}
        />
        <TimePicker
          label={t('schedule.end')}
          value={range.end_time}
          onChange={(value) => update({ end_time: value })}
          error={showErrors ? (endError ?? undefined) : undefined}
        />
        {config.overnight ? (
          <Text variant="caption" color="muted">
            {t('schedule.closure_end_helper')}
          </Text>
        ) : null}
        <Text weight="medium" accessibilityLiveRegion="polite">
          {line(range)}
        </Text>
        <View accessibilityLiveRegion="polite" role={serverError ? 'alert' : undefined}>
          {serverError ? <Text color="danger">{serverError}</Text> : null}
        </View>
        <Button label={t(config.keys.save)} onPress={submit} disabled={save.isPending} block />
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
        body={t(config.keys.confirmBody, { line: line(initial) })}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  start: { alignItems: 'flex-start' },
});
