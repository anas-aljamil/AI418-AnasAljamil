/**
 * Professor home, "My status" (DESIGN.md 7.8), usable in one tap by anyone: four door tiles
 * (the current one selected), quick presets with a return time, an optional 60-character note,
 * today's timeline and the requests waiting for an answer.
 */
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Check from 'lucide-react-native/icons/check';

import {
  useMyStatus,
  useProfessor,
  useRequests,
  useSetStatus,
  type StatusInput,
} from '@/api/queries';
import type { ManualStatus } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Door } from '@/components/Door';
import { SkeletonRow } from '@/components/Placeholders';
import { describeStatus } from '@/components/StatusLabel';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { TodayTimeline } from '@/components/TodayTimeline';
import { useToast } from '@/components/Toast';
import { AppointmentCard } from '@/features/appointments/AppointmentCard';
import { RequestActions } from '@/features/appointments/RequestActions';
import { minutesOfDay, riyadhTime } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, space, type Language } from '@/theme/tokens';

const TILES: ManualStatus[] = ['in_office', 'in_class', 'busy', 'away'];
const MANUAL = new Set<string>(TILES);

export default function StatusScreen() {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const toast = useToast();
  const user = useUser();
  const status = useMyStatus();
  const profile = useProfessor(user.user_id);
  const requests = useRequests();
  const setStatus = useSetStatus();

  const current = status.data;
  // The note field starts from the saved note once the status has loaded.
  const [note, setNote] = useState('');
  const [noteLoaded, setNoteLoaded] = useState(false);
  if (current && !noteLoaded) {
    setNoteLoaded(true);
    setNote(current.source === 'override' ? (current.note ?? '') : '');
  }

  const apply = (input: StatusInput | null, onDone?: () => void) => {
    if (input && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    setStatus.mutate(input, {
      onSuccess: onDone,
      onError: () => toast(t('status_screen.failed')),
    });
  };
  const withNote = (input: StatusInput): StatusInput => ({ ...input, note: note.trim() || null });
  const inMinutes = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();

  // "In office until …": the end of the current or next office-hours block today.
  const today = profile.data?.today;
  const officeEnd = today?.blocks.find(
    (b) => b.kind === 'office_hours' && minutesOfDay(b.end_time) > minutesOfDay(now),
  )?.end_time;

  const described = current
    ? describeStatus(
        current.status,
        current.confirmed,
        current.updated_at ? new Date(current.updated_at) : null,
        now,
        language,
        t,
      )
    : null;
  const pending = (requests.data ?? []).filter((a) => a.status === 'pending');

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Text variant="heading" role="heading">
        {t('status_screen.title')}
      </Text>

      {current && described ? (
        <>
          <View role="radiogroup" style={styles.tiles}>
            {TILES.map((tile) => {
              const selected = current.status === tile;
              return (
                <Pressable
                  key={tile}
                  role="radio"
                  aria-checked={selected}
                  accessibilityLabel={t(`status.${tile}`)}
                  onPress={() => apply(withNote({ status: tile }))}
                  style={({ pressed }) => [
                    styles.tile,
                    {
                      backgroundColor: pressed ? colors.line : colors.surface,
                      borderColor: selected ? colors.primary : colors.line,
                      borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <Door status={tile} size={40} />
                  <Text variant="label" weight="semibold" style={styles.grow}>
                    {t(`status.${tile}`)}
                  </Text>
                  {selected ? <Check color={colors.primary} size={20} strokeWidth={2.5} /> : null}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.section} accessibilityLiveRegion="polite">
            <Text color="muted">
              {current.source === 'override'
                ? spokenList(
                    [
                      t('status_screen.manual', { updated: described.updated }),
                      current.until
                        ? t('prof.until', { time: riyadhTime(new Date(current.until)) })
                        : null,
                    ],
                    t,
                  )
                : t('status_screen.following_schedule', { status: described.label })}
            </Text>
            {current.source === 'override' ? (
              <View style={styles.start}>
                <Button
                  variant="quiet"
                  label={t('status_screen.back_to_schedule')}
                  onPress={() => apply(null)}
                />
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text variant="label" role="heading">
              {t('status_screen.presets')}
            </Text>
            <View style={styles.chips}>
              <Chip
                label={t('status_screen.back_in_15')}
                onPress={() => apply(withNote({ status: 'away', expires_at: inMinutes(15) }))}
              />
              <Chip
                label={t('status_screen.back_in_30')}
                onPress={() => apply(withNote({ status: 'away', expires_at: inMinutes(30) }))}
              />
              {officeEnd && today ? (
                <Chip
                  label={t('status_screen.in_office_until', { time: officeEnd })}
                  onPress={() =>
                    apply(
                      withNote({
                        status: 'in_office',
                        expires_at: new Date(`${today.date}T${officeEnd}:00+03:00`).toISOString(),
                      }),
                    )
                  }
                />
              ) : null}
              <Chip
                label={t('status_screen.away_today')}
                onPress={() => apply(withNote({ status: 'away' }))}
              />
            </View>
          </View>

          <View style={styles.section}>
            <TextField
              label={t('status_screen.note_label')}
              helper={t('status_screen.note_helper')}
              value={note}
              onChangeText={setNote}
              maxLength={60}
            />
            <View style={styles.start}>
              <Button
                variant="secondary"
                label={t('status_screen.save_note')}
                onPress={() =>
                  apply(
                    withNote({
                      status: MANUAL.has(current.status)
                        ? (current.status as ManualStatus)
                        : 'away',
                      expires_at: current.source === 'override' ? current.until : null,
                    }),
                    () => toast(t('status_screen.note_saved')),
                  )
                }
              />
            </View>
          </View>
        </>
      ) : (
        <View>
          <SkeletonRow />
          <SkeletonRow />
        </View>
      )}

      <View style={styles.section}>
        <Text variant="title" role="heading">
          {t('prof.today')}
        </Text>
        {today ? (
          <TodayTimeline blocks={today.blocks} now={today.now_local_time} />
        ) : (
          <SkeletonRow />
        )}
      </View>

      <View style={styles.section}>
        <Text variant="title" role="heading">
          {t('status_screen.waiting', { count: pending.length })}
        </Text>
        {pending.slice(0, 3).map((appointment) => (
          <AppointmentCard
            key={appointment.appointment_id}
            appointment={appointment}
            now={now}
            perspective="professor"
          >
            <RequestActions appointment={appointment} now={now} />
          </AppointmentCard>
        ))}
        <View style={styles.start}>
          <Button
            variant="quiet"
            label={t('status_screen.all_requests')}
            onPress={() => router.navigate('/staff/requests')}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.md, paddingBottom: space.xl, gap: space.lg },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 72,
    borderRadius: radii.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
  },
  grow: { flex: 1 },
  section: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  start: { alignItems: 'flex-start' },
});
