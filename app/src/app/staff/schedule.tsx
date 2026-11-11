/**
 * Weekly schedule editor, in three views behind one switch:
 * - Timetable: office hours, classes and meetings on working days (they drive the live status);
 * - Booking: the times students can book in, inside or outside office hours;
 * - Messages: the weekly hours when students cannot write.
 * Each view is a week (WeekAgenda: a list per day on phones, a week grid on desktop), and each
 * item is added, edited and deleted in a sheet. Times are Riyadh times on a 15-minute grid,
 * picked as a start and a length from two menus (TimeRangePicker); a new item may go on
 * several days at once. Each repeats every week, every week until a date, or happens on one
 * date (WhenPicker, 2026-11-11); a saved weekly item can leave out single dates. Overlaps are
 * refused by the API. (The usual appointment length setting was removed on 2026-11-11.)
 */
import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Plus from 'lucide-react-native/icons/plus';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDeleteBlock, useMySchedule, useSaveBlock, type BlockInput } from '@/api/queries';
import { useColumn } from '@/lib/layout';
import type { Block } from '@/api/types';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { Door } from '@/components/Door';
import { SkeletonRow } from '@/components/Placeholders';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { TimeRangePicker } from '@/components/TimeRangePicker';
import { useToast } from '@/components/Toast';
import { SectionError } from '@/features/home/HomeParts';
import { WeekAgenda } from '@/features/schedule/WeekAgenda';
import {
  saveWhen,
  SkipDates,
  whenError,
  whenLine,
  whenOf,
  WhenPicker,
  type WhenDraft,
} from '@/features/schedule/WhenPicker';
import { WeeklyRanges } from '@/features/schedule/WeeklyRanges';
import { BLOCK_KINDS, BLOCK_PATTERN, BLOCK_STATUS, blockKindKey } from '@/lib/blocks';
import { errorKey } from '@/lib/errors';
import { clockText, daysText } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const DAYS = [0, 1, 2, 3, 4];
type ScheduleView = 'timetable' | 'booking' | 'chat';
const VIEWS: ScheduleView[] = ['timetable', 'booking', 'chat'];
const EMPTY: BlockInput = {
  kind: 'office_hours',
  day_of_week: 0,
  on_date: null,
  ends_on: null,
  // A sensible first guess; the pickers change it in a tap or two.
  start_time: '10:00',
  end_time: '11:00',
  label: null,
};

export default function ScheduleScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const column = useColumn();
  // ?view=booking or ?view=chat opens that view (links from elsewhere in the app).
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<ScheduleView>(
    VIEWS.find((option) => option === params.view) ?? 'timetable',
  );
  const schedule = useMySchedule();
  const [editing, setEditing] = useState<{ id: number | null; block: BlockInput } | null>(null);

  const line = (block: BlockInput) =>
    t('prof.block_line', {
      start: clockText(block.start_time, t),
      end: clockText(block.end_time, t),
      kind: t(blockKindKey(block.kind)),
    }) + (block.label ? ` (${block.label})` : '');

  return (
    <>
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={[styles.page, column, { paddingTop: insets.top + space.lg }]}
      >
        <Text variant="heading" role="heading">
          {t('schedule.title')}
        </Text>
        <View accessibilityLabel={t('schedule.view_label')}>
          <Segmented
            options={VIEWS.map((value) => ({ value, label: t(`schedule.view_${value}`) }))}
            value={view}
            onChange={setView}
          />
        </View>

        {view === 'booking' ? (
          <WeeklyRanges kind="booking-periods" />
        ) : view === 'chat' ? (
          <WeeklyRanges kind="chat-closed-hours" />
        ) : (
          <>
            <View style={styles.start}>
              <Button
                label={t('schedule.add')}
                icon={<Plus color={colors.onPrimary} size={20} strokeWidth={2} />}
                onPress={() => setEditing({ id: null, block: { ...EMPTY } })}
              />
            </View>

            {schedule.data === undefined && !schedule.error ? (
              <SkeletonRow />
            ) : schedule.error ? (
              <SectionError
                message={t(errorKey(schedule.error))}
                onRetry={() => schedule.refetch()}
              />
            ) : (
              <WeekAgenda
                days={DAYS}
                overview
                items={(schedule.data ?? []).map((block: Block) => ({
                  key: String(block.block_id),
                  range: block,
                  title: t(blockKindKey(block.kind)),
                  label: block.label,
                  color: colors.status[BLOCK_STATUS[block.kind]],
                  pattern: BLOCK_PATTERN[block.kind],
                  icon: <Door status={BLOCK_STATUS[block.kind]} size={24} />,
                  onPress: () => setEditing({ id: block.block_id, block }),
                }))}
              />
            )}
          </>
        )}
      </ScrollView>
      {editing ? (
        <BlockSheet
          key={editing.id ?? 'new'}
          id={editing.id}
          initial={editing.block}
          line={line}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

interface BlockSheetProps {
  id: number | null;
  initial: BlockInput;
  line: (block: BlockInput) => string;
  onClose: () => void;
}

function BlockSheet({ id, initial, line, onClose }: BlockSheetProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useSaveBlock();
  const remove = useDeleteBlock();
  const [block, setBlock] = useState<BlockInput>(initial);
  const [when, setWhen] = useState<WhenDraft>(whenOf(initial));
  // The saved block as the list has it now, for its skipped dates.
  const live = useMySchedule().data?.find((b) => b.block_id === id);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const update = (patch: Partial<BlockInput>) => setBlock((current) => ({ ...current, ...patch }));

  const missing = whenError(when);

  const submit = async () => {
    setShowErrors(true);
    if (missing) return;
    setServerError(null);
    setSaving(true);
    const label = block.label?.trim() || null;
    const result = await saveWhen(
      when,
      (fields) => save.mutateAsync({ id, block: { ...block, label, ...fields } }),
      t,
    );
    setSaving(false);
    if (result.failed.length === 0) {
      toast(t('schedule.saved'));
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
        toast(t('schedule.deleted'));
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
        title={t(id === null ? 'schedule.new_title' : 'schedule.edit_title')}
        onClose={onClose}
      >
        <WhenPicker
          value={when}
          onChange={setWhen}
          workingDays
          multiple={id === null}
          showErrors={showErrors}
        />
        <Text variant="label" role="heading">
          {t('schedule.kind')}
        </Text>
        <View style={styles.chips}>
          {BLOCK_KINDS.map((kind) => (
            <Chip
              key={kind}
              label={t(blockKindKey(kind))}
              selected={block.kind === kind}
              onPress={() => update({ kind })}
            />
          ))}
        </View>
        <TimeRangePicker value={block} onChange={update} />
        <TextField
          label={t('schedule.label')}
          helper={t('schedule.label_helper')}
          value={block.label ?? ''}
          onChangeText={(value) => update({ label: value })}
          maxLength={40}
        />
        {!missing ? (
          <Text weight="medium" accessibilityLiveRegion="polite">
            {whenLine(when, line(block), t)}
          </Text>
        ) : null}
        <View accessibilityLiveRegion="polite" role={serverError ? 'alert' : undefined}>
          {serverError ? <Text color="danger">{serverError}</Text> : null}
        </View>
        <Button label={t('schedule.save')} onPress={submit} disabled={saving} block />
        {id !== null && live && live.day_of_week !== null && when.repeat !== 'once' ? (
          <SkipDates path="schedule" id={id} row={live} />
        ) : null}
        {id !== null ? (
          <Button
            variant="danger"
            label={t('schedule.delete')}
            onPress={() => setConfirming(true)}
            block
          />
        ) : null}
      </BottomSheet>
      <ConfirmSheet
        visible={confirming}
        title={t('schedule.confirm_delete_title')}
        body={t('schedule.confirm_delete_body', { line: line(initial) })}
        confirmLabel={t('schedule.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(false)}
        busy={remove.isPending}
      />
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.md, paddingBottom: space.xl, gap: space.lg },
  section: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  start: { alignItems: 'flex-start' },
});
