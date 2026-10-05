/**
 * Weekly schedule editor: the professor's office hours and classes for Sunday to Thursday,
 * added, edited and deleted in a sheet, plus the appointment length (15 or 30 minutes).
 * Times are Riyadh times on a 15-minute grid; overlaps are refused by the API.
 */
import { useState } from 'react';
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
import type { Block } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { SkeletonRow } from '@/components/Placeholders';
import { ListRow } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { SectionError } from '@/features/home/HomeParts';
import { errorKey } from '@/lib/errors';
import { minutesOfDay } from '@/lib/format';
import { isQuarterHour } from '@/lib/validation';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const DAYS = [0, 1, 2, 3, 4];
const EMPTY: BlockInput = {
  kind: 'office_hours',
  day_of_week: 0,
  start_time: '',
  end_time: '',
  label: null,
};

export default function ScheduleScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const user = useUser();
  const schedule = useMySchedule();
  const slotLength = useSlotLength();
  const [minutes, setMinutes] = useState(user.professor?.slot_minutes ?? 15);
  const [editing, setEditing] = useState<{ id: number | null; block: BlockInput } | null>(null);

  const line = (block: BlockInput) =>
    t('prof.block_line', {
      start: block.start_time,
      end: block.end_time,
      kind: block.kind === 'office_hours' ? t('prof.office_hours') : t('prof.class'),
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
        contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}
      >
        <Text variant="heading" role="heading">
          {t('schedule.title')}
        </Text>

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
          <SectionError message={t(errorKey(schedule.error))} onRetry={() => schedule.refetch()} />
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
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const update = (patch: Partial<BlockInput>) => setBlock((current) => ({ ...current, ...patch }));

  const startError = !isQuarterHour(block.start_time) ? t('schedule.time_invalid') : null;
  const endError = !isQuarterHour(block.end_time)
    ? t('schedule.time_invalid')
    : !startError && minutesOfDay(block.end_time) <= minutesOfDay(block.start_time)
      ? t('schedule.end_before_start')
      : null;

  const submit = () => {
    setShowErrors(true);
    if (startError || endError) return;
    setServerError(null);
    save.mutate(
      { id, block: { ...block, label: block.label?.trim() || null } },
      {
        onSuccess: () => {
          toast(t('schedule.saved'));
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
        <Text variant="label" role="heading">
          {t('schedule.day')}
        </Text>
        <View style={styles.chips}>
          {DAYS.map((day) => (
            <Chip
              key={day}
              label={t(`weekday.${day}`)}
              selected={block.day_of_week === day}
              onPress={() => update({ day_of_week: day })}
            />
          ))}
        </View>
        <Text variant="label" role="heading">
          {t('schedule.kind')}
        </Text>
        <View style={styles.chips}>
          {(['office_hours', 'class'] as const).map((kind) => (
            <Chip
              key={kind}
              label={t(kind === 'office_hours' ? 'prof.office_hours' : 'prof.class')}
              selected={block.kind === kind}
              onPress={() => update({ kind })}
            />
          ))}
        </View>
        <TextField
          label={t('schedule.start')}
          value={block.start_time}
          onChangeText={(value) => update({ start_time: value.trim() })}
          error={showErrors ? (startError ?? undefined) : undefined}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />
        <TextField
          label={t('schedule.end')}
          value={block.end_time}
          onChangeText={(value) => update({ end_time: value.trim() })}
          error={showErrors ? (endError ?? undefined) : undefined}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />
        <TextField
          label={t('schedule.label')}
          helper={t('schedule.label_helper')}
          value={block.label ?? ''}
          onChangeText={(value) => update({ label: value })}
          maxLength={40}
        />
        <View accessibilityLiveRegion="polite" role={serverError ? 'alert' : undefined}>
          {serverError ? <Text color="danger">{serverError}</Text> : null}
        </View>
        <Button label={t('schedule.save')} onPress={submit} disabled={save.isPending} block />
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
