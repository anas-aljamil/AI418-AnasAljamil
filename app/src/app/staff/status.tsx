/**
 * Professor home, "My status" (DESIGN.md 7.8), usable in one tap by anyone: four door tiles
 * (the current one selected), quick presets with a return time, an optional 60-character note,
 * today's timeline and the requests waiting for an answer.
 */
import { useEffect, useState } from 'react';
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
import { useColumn, useLayout } from '@/lib/layout';
import type { ManualStatus } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { AppBar } from '@/components/AppBar';
import { Door } from '@/components/Door';
import { NotificationBell } from '@/components/NotificationBell';
import { SkeletonRow } from '@/components/Placeholders';
import { describeStatus } from '@/components/StatusLabel';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { TodayTimeline } from '@/components/TodayTimeline';
import { useToast } from '@/components/Toast';
import { AppointmentCard } from '@/features/appointments/AppointmentCard';
import { RequestActions } from '@/features/appointments/RequestActions';
import { clockText, minutesOfDay, untilText } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radii, space, type Language } from '@/theme/tokens';

const TILES: ManualStatus[] = ['in_office', 'in_class', 'busy', 'away'];
const MANUAL = new Set<string>(TILES);

export default function StatusScreen() {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const column = useColumn();
  const desktop = useLayout() === 'desktop';
  const now = useNow();
  const toast = useToast();
  const user = useUser();
  const status = useMyStatus();
  const profile = useProfessor(user.user_id);
  const requests = useRequests();
  const setStatus = useSetStatus();

  const current = status.data;
  // The note students see (owner request 2026-11-11: the professor sees it too, as a card with
  // when it goes, Edit and Delete). It belongs to a status the professor set; while the field
  // is open, the draft is what a status tap saves with.
  const savedNote = current?.source === 'override' ? current.note : null;
  const [draft, setDraft] = useState<string | null>(null);

  const apply = (input: StatusInput | null, onDone?: () => void) => {
    if (input && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    setStatus.mutate(input, {
      onSuccess: onDone,
      onError: () => toast(t('status_screen.failed')),
    });
  };
  const withNote = (input: StatusInput): StatusInput => ({
    ...input,
    note: (draft ?? savedNote ?? '').trim() || null,
  });
  // Whole minutes, so the status ends at exactly the time it shows ("until 10:15 AM", not 10:15:40).
  const inMinutes = (minutes: number) => {
    const end = new Date(now.getTime() + minutes * 60_000);
    end.setSeconds(0, 0);
    return end.toISOString();
  };

  // "In office until …": the end of the current or next office-hours block today.
  const today = profile.data?.today;
  const officeEnd = today?.blocks.find(
    (b) => b.kind === 'office_hours' && minutesOfDay(b.end_time) > minutesOfDay(now),
  )?.end_time;

  // A note saved while following the schedule keeps the current status only until the schedule
  // changes (the end of this block, or the start of the next one today), not all day: saving
  // used to pin "In office" until midnight.
  const nextStart = today?.blocks
    .map((b) => b.start_time)
    .filter((start) => minutesOfDay(start) > minutesOfDay(now))
    .sort()[0];
  const noteExpiry = (): string | null => {
    if (!current) return null;
    if (current.until) return current.until;
    if (current.source === 'override' || !today || !nextStart) return null;
    return new Date(`${today.date}T${nextStart}:00+03:00`).toISOString();
  };
  const saveNote = (text: string | null) => {
    if (!current) return;
    apply(
      {
        status: MANUAL.has(current.status) ? (current.status as ManualStatus) : 'away',
        expires_at: noteExpiry(),
        note: text?.trim() || null,
      },
      () => {
        setDraft(null);
        toast(t(text?.trim() ? 'status_screen.note_saved' : 'status_screen.note_removed'));
      },
    );
  };

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

  // The browser tab shows the status, so a professor can keep the tab open (DESIGN.md 7.8).
  const tabTitle = described ? `${described.label} | ${t('app.name')}` : null;
  useEffect(() => {
    if (Platform.OS !== 'web' || !tabTitle) return;
    const before = document.title;
    document.title = tabTitle;
    return () => {
      document.title = before;
    };
  }, [tabTitle]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[
        styles.page,
        desktop ? styles.wide : column,
        { paddingTop: insets.top + space.lg },
      ]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {/* Desktop: the status controls on the start side, today and the requests beside them. */}
      <View style={desktop ? styles.columns : styles.stack}>
        <View style={desktop ? styles.column : styles.stack}>
          <AppBar>
            <NotificationBell />
          </AppBar>
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
                      {selected ? (
                        <Check color={colors.primary} size={20} strokeWidth={2.5} />
                      ) : null}
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
                          current.until ? untilText(new Date(current.until), t) : null,
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
                      onPress={() => apply(null, () => setDraft(null))}
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
                      label={t('status_screen.in_office_until', { time: clockText(officeEnd, t) })}
                      onPress={() =>
                        apply(
                          withNote({
                            status: 'in_office',
                            expires_at: new Date(
                              `${today.date}T${officeEnd}:00+03:00`,
                            ).toISOString(),
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
                {draft !== null ? (
                  <>
                    <TextField
                      label={t('status_screen.note_label')}
                      helper={t('status_screen.note_helper')}
                      placeholder={t('status_screen.note_placeholder')}
                      value={draft}
                      onChangeText={setDraft}
                      maxLength={60}
                    />
                    <View style={styles.noteActions}>
                      <Button
                        label={t('status_screen.save_note')}
                        onPress={() => saveNote(draft)}
                        disabled={!draft.trim() || setStatus.isPending}
                      />
                      <Button
                        variant="quiet"
                        label={t('common.cancel')}
                        onPress={() => setDraft(null)}
                      />
                    </View>
                  </>
                ) : savedNote ? (
                  <View
                    style={[
                      styles.noteCard,
                      { backgroundColor: colors.surface, borderColor: colors.line },
                    ]}
                  >
                    <Text variant="label" role="heading">
                      {t('status_screen.note_heading')}
                    </Text>
                    {/* The same line students see on the profile. */}
                    <Text weight="medium">{t('prof.note', { note: savedNote })}</Text>
                    <Text variant="caption" color="muted">
                      {t('status_screen.note_shown', {
                        when: current.until
                          ? untilText(new Date(current.until), t)
                          : t('prof.until_end_of_day'),
                      })}
                    </Text>
                    <View style={styles.noteActions}>
                      <Button
                        variant="secondary"
                        label={t('status_screen.note_edit')}
                        onPress={() => setDraft(savedNote)}
                      />
                      <Button
                        variant="quiet"
                        label={t('status_screen.note_delete')}
                        onPress={() => saveNote(null)}
                        disabled={setStatus.isPending}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.start}>
                    <Button
                      variant="secondary"
                      label={t('status_screen.note_add')}
                      onPress={() => setDraft('')}
                    />
                  </View>
                )}
              </View>
            </>
          ) : (
            <View>
              <SkeletonRow />
              <SkeletonRow />
            </View>
          )}
        </View>

        <View style={desktop ? styles.column : styles.stack}>
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
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.md, paddingBottom: space.xl, gap: space.lg },
  stack: { gap: space.lg },
  wide: { paddingHorizontal: space.xl },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xl },
  column: { flex: 1, gap: space.lg, maxWidth: layout.column },
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
  noteCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.card,
    padding: space.md,
    gap: space.xs,
  },
  noteActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  start: { alignItems: 'flex-start' },
});
