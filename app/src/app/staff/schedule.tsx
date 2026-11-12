/**
 * Weekly schedule editor, in three views behind one switch:
 * - Timetable: office hours and classes for Sunday to Thursday (they drive the live status),
 *   plus the usual appointment length (15 or 30 minutes);
 * - Booking: the times students can book in, inside or outside office hours;
 * - Messages: the weekly hours when students cannot write.
 * Each item is added, edited and deleted in a sheet. Times are Riyadh times on a 15-minute
 * grid, picked as a start and a length (TimeRangePicker); a new item may go on several days
 * at once. Overlaps are refused by the API.
 */
import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useDeleteBlock,
  useMySchedule,
  useSaveBlock,
  useSlotLength,
  type BlockInput,
} from '@/api/queries';
import { useColumn } from '@/lib/layout';
import type { Block } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { SkeletonRow } from '@/components/Placeholders';
import { Segmented } from '@/components/Segmented';
import { ListRow } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { TimeRangePicker } from '@/components/TimeRangePicker';
import { useToast } from '@/components/Toast';
import { SectionError } from '@/features/home/HomeParts';
import { DayChips, saveEachDay } from '@/features/schedule/days';
import { WeeklyRanges } from '@/features/schedule/WeeklyRanges';
import { BLOCK_KINDS, blockKindKey } from '@/lib/blocks';
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
  const toast = useToast();
  const user = useUser();
  // ?view=booking or ?view=chat opens that view (links from elsewhere in the app).
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<ScheduleView>(
    VIEWS.find((option) => option === params.view) ?? 'timetable',
  );
  const schedule = useMySchedule();
  const slotLength = useSlotLength();
  const [minutes, setMinutes] = useState(user.professor?.slot_minutes ?? 15);
  const [editing, setEditing] = useState<{ id: number | null; block: BlockInput } | null>(null);

  const line = (block: BlockInput) =>
    t('prof.block_line', {
      start: clockText(block.start_time, t),
      end: clockText(block.end_time, t),
      kind: t(blockKindKey(block.kind)),
    }) + (block.label ? ` (${block.label})` : '');

  const changeLength = (value: 15 | 30) => {
    const previous = minutes;
    setMinutes(value);
    slotLength.mutate(value, {
      onSuccess: () => toast(t('schedule.slot_saved')),
      onError: (error) => {
        setMinutes(previous);
        toast(t(errorKey(error)));
      },
    });
  };

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
            <View style={styles.section}>
              <Text variant="label" role="heading">
                {t('schedule.slot_length')}
              </Text>
              <View style={styles.chips}>
                {([15, 30] as const).map((value) => (
                  <Chip
                    key={value}
                    label={t(`schedule.minutes_${value}`)}
                    selected={minutes === value}
                    onPress={() => changeLength(value)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.start}>
              <Button
                label={t('schedule.add')}
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
              DAYS.map((day) => {
                const blocks = (schedule.data ?? []).filter((b) => b.day_of_week === day);
                return (
                  <View key={day} style={styles.section}>
                    <Text variant="title" role="heading">
                      {t(`weekday.${day}`)}
                    </Text>
                    {blocks.length === 0 ? (
                      <Text color="muted">{t('schedule.empty_day')}</Text>
                    ) : (
                      blocks.map((block: Block) => (
                        <ListRow
                          key={block.block_id}
                          title={line(block)}
                          onPress={() => setEditing({ id: block.block_id, block })}
                        />
                      ))
                    )}
                  </View>
                );
              })
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
  const [days, setDays] = useState([initial.day_of_week]);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const update = (patch: Partial<BlockInput>) => setBlock((current) => ({ ...current, ...patch }));

  const daysError = days.length === 0 ? t('schedule.days_missing') : undefined;

  const submit = async () => {
    setShowErrors(true);
    if (daysError) return;
    setServerError(null);
    setSaving(true);
    const label = block.label?.trim() || null;
    const result = await saveEachDay(
      days,
      (day) => save.mutateAsync({ id, block: { ...block, label, day_of_week: day } }),
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
    setDays(result.failed);
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
        <DayChips
          days={DAYS}
          value={days}
          onChange={setDays}
          multiple={id === null}
          error={showErrors ? daysError : undefined}
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
        {days.length > 0 ? (
          <Text weight="medium" accessibilityLiveRegion="polite">
            {t('schedule.day_line', { day: daysText(days, t), range: line(block) })}
          </Text>
        ) : null}
        <View accessibilityLiveRegion="polite" role={serverError ? 'alert' : undefined}>
          {serverError ? <Text color="danger">{serverError}</Text> : null}
        </View>
        <Button label={t('schedule.save')} onPress={submit} disabled={saving} block />
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
