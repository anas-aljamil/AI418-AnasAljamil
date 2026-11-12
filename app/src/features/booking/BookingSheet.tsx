/**
 * Booking (DESIGN.md 7.5): a bottom sheet with a calendar of this week and next (Sunday to
 * Thursday, owner request 2026-11-11; days without a booking time are dimmed), the free stretches of that day, a start on any 5-minute step (one menu, grouped by
 * hour, owner request 2026-11-11), an optional length (15 minutes unless the
 * student opens "Change length": a stepper and one-tap lengths in 5-minute steps, never past
 * the next booking or the end of the booking time), optional topic and note, a summary, then
 * the one orchestrated moment: the door opens, a check appears, "Booked with Dr. X, Sunday
 * 10:30", and a success haptic.
 *
 * Times come from the professor's booking times, which may lie outside office hours; days
 * without one are dimmed. Steps from the profile: Book, (day, defaulted to the first day with
 * a booking time, weekly or dated), start, confirm. Unavailable starts stay in the menu, dimmed, and say why
 * ("10:15 AM, booked"). An error never clears the day, topic or note; only a time that was
 * just taken by someone else is unselected.
 */
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import Check from 'lucide-react-native/icons/check';

import { ApiError } from '@/api/client';
import { useBook, useSlots } from '@/api/queries';
import type { Appointment, ProfessorDetail, Slot, Topic } from '@/api/types';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Calendar } from '@/components/Calendar';
import { Chip } from '@/components/Chip';
import { Door } from '@/components/Door';
import { MenuPicker, type MenuOption } from '@/components/MenuPicker';
import { SkeletonRow } from '@/components/Placeholders';
import { StepButton } from '@/components/StepButton';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { insetEnd } from '@/lib/direction';
import { errorKey } from '@/lib/errors';
import { todayKey } from '@/lib/dates';
import { addMinutes, bookingDays, clockText, hourText, whenText } from '@/lib/format';
import { officeText, professorName } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { space, type Language } from '@/theme/tokens';
import { fitLength, freeWindows, QUICK_LENGTHS, STEP } from './times';

const TOPICS: Topic[] = ['assignment', 'exam_review', 'advising', 'other'];
/** The length offered first, as the API's default (no per-professor usual length). */
const DEFAULT_MINUTES = 15;

interface BookingSheetProps {
  professor: ProfessorDetail;
  visible: boolean;
  onClose: () => void;
}

export function BookingSheet({ professor, visible, onClose }: BookingSheetProps) {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const name = professorName(professor, language, t);
  const days = useMemo(() => bookingDays(new Date()), []);
  // The calendar's days with a booking time (weekly or dated), from the profile.
  const bookable = new Set(professor.booking_days);
  const [day, setDay] = useState((days.find((d) => bookable.has(d.date)) ?? days[0])?.date ?? null);
  const [slot, setSlot] = useState<Slot | null>(null);
  // The length the student chose; until then the professor's usual length (both fitted).
  const [length, setLength] = useState<number | null>(null);
  // Length is optional: its controls stay folded until the student asks to change it.
  const [lengthOpen, setLengthOpen] = useState(false);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [booked, setBooked] = useState<Appointment | null>(null);
  const slots = useSlots(professor.professor_id, visible ? day : null);
  const book = useBook();

  const close = () => {
    onClose();
    // A new booking starts fresh; an unfinished one keeps its choices while the sheet is open.
    if (booked) {
      setBooked(null);
      setSlot(null);
      setLength(null);
      setLengthOpen(false);
      setTopic(null);
      setNote('');
    }
    setMessage(null);
  };

  const chooseDay = (date: string) => {
    setDay(date);
    setSlot(null);
    setMessage(null);
  };

  const daySlots = slots.data?.slots ?? [];
  const windows = freeWindows(daySlots);
  const usual = slots.data?.default_minutes ?? DEFAULT_MINUTES;
  const minutes = slot ? fitLength(length ?? usual, slot.max_minutes) : 0;
  const listSeparator = language === 'ar' ? '، ' : ', ';
  // Every start of the day under its hour; taken and past ones stay, dimmed, and say why.
  const startOptions: MenuOption[] = daySlots.map((option) => {
    const time = clockText(option.local_time, t);
    return {
      value: option.starts_at,
      label: option.available
        ? time
        : t(option.reason === 'past' ? 'booking.option_past' : 'booking.option_taken', { time }),
      group: hourText(Number(option.local_time.slice(0, 2)), t),
      disabled: !option.available,
    };
  });

  const chooseSlot = (startsAt: string) => {
    const option = daySlots.find((s) => s.starts_at === startsAt && s.available);
    if (!option) return;
    setSlot(option);
    setMessage(null);
  };

  const confirm = () => {
    if (!slot) return;
    setMessage(null);
    book.mutate(
      {
        professor_id: professor.professor_id,
        starts_at: slot.starts_at,
        minutes,
        topic,
        note: note.trim() || null,
      },
      {
        onSuccess: (appointment) => {
          setBooked(appointment);
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
              () => undefined,
            );
          }
        },
        onError: (error) => {
          setMessage(t(errorKey(error)));
          // The times reload with the professor's data after every booking attempt.
          if (error instanceof ApiError && error.code === 'SLOT_TAKEN') setSlot(null);
        },
      },
    );
  };

  const when = slot ? whenText(new Date(slot.starts_at), new Date(), t) : '';

  return (
    <BottomSheet visible={visible} title={t('booking.title', { name })} onClose={close}>
      {booked ? (
        <BookedMoment
          text={t('booking.booked', {
            name,
            when: whenText(new Date(booked.starts_at), new Date(), t),
          })}
          onDone={close}
        />
      ) : (
        <>
          <Text variant="label" role="heading">
            {t('booking.day')}
          </Text>
          {days.length ? (
            <Calendar
              label={t('booking.day')}
              value={day}
              onChange={chooseDay}
              from={days[0]!.date}
              to={days[days.length - 1]!.date}
              today={todayKey(new Date())}
              enabled={(date) => bookable.has(date)}
            />
          ) : null}

          <Text variant="label" role="heading">
            {t('booking.time')}
          </Text>
          {slots.data === undefined && !slots.error ? (
            <SkeletonRow />
          ) : slots.error ? (
            <Text color="danger">{t(errorKey(slots.error))}</Text>
          ) : daySlots.length ? (
            <>
              <Text color={windows.length ? 'muted' : 'danger'}>
                {windows.length
                  ? t('booking.free', {
                      windows: windows
                        .map((w) =>
                          t('booking.window', {
                            start: clockText(w.start, t),
                            end: clockText(w.end, t),
                          }),
                        )
                        .join(listSeparator),
                    })
                  : t('booking.no_free')}
              </Text>
              <MenuPicker
                label={t('booking.start')}
                options={startOptions}
                value={slot?.starts_at ?? ''}
                onChange={chooseSlot}
                placeholder={t('booking.choose_start')}
                compact
              />
            </>
          ) : (
            <Text color="muted">{t('booking.no_times')}</Text>
          )}

          {slot ? (
            <>
              <Text variant="label" role="heading">
                {t('booking.length')}
              </Text>
              {lengthOpen ? (
                <>
                  <View style={styles.stepper}>
                    <StepButton
                      label={t('booking.shorter')}
                      disabled={minutes <= STEP}
                      onPress={() => setLength(minutes - STEP)}
                      icon="minus"
                    />
                    <Text
                      weight="semibold"
                      style={[styles.grow, styles.center]}
                      accessibilityLiveRegion="polite"
                    >
                      {t('booking.length_value', {
                        minutes,
                        end: clockText(addMinutes(slot.local_time, minutes), t),
                      })}
                    </Text>
                    <StepButton
                      label={t('booking.longer')}
                      disabled={minutes >= slot.max_minutes}
                      onPress={() => setLength(minutes + STEP)}
                      icon="plus"
                    />
                  </View>
                  <View style={styles.wrap}>
                    {QUICK_LENGTHS.filter((option) => option <= slot.max_minutes).map((option) => (
                      <Chip
                        key={option}
                        label={t('booking.minutes_chip', { minutes: option })}
                        accessibilityLabel={t('booking.minutes_long', { minutes: option })}
                        selected={minutes === option}
                        onPress={() => setLength(option)}
                      />
                    ))}
                  </View>
                  <Text variant="caption" color="muted">
                    {t('booking.length_max', {
                      minutes: slot.max_minutes,
                      time: clockText(slot.local_time, t),
                    })}
                  </Text>
                </>
              ) : (
                <View style={styles.stepper}>
                  <View style={styles.grow}>
                    <Text weight="semibold" accessibilityLiveRegion="polite">
                      {t('booking.length_value', {
                        minutes,
                        end: clockText(addMinutes(slot.local_time, minutes), t),
                      })}
                    </Text>
                    <Text variant="caption" color="muted">
                      {minutes === usual
                        ? t('booking.usual_length')
                        : t('booking.length_max', {
                            minutes: slot.max_minutes,
                            time: clockText(slot.local_time, t),
                          })}
                    </Text>
                  </View>
                  <Button
                    variant="quiet"
                    label={t('booking.change_length')}
                    onPress={() => setLengthOpen(true)}
                  />
                </View>
              )}
            </>
          ) : null}

          <Text variant="label" role="heading">
            {t('booking.topic')}
          </Text>
          <View style={styles.wrap}>
            {TOPICS.map((option) => (
              <Chip
                key={option}
                label={t(`booking.topic_${option}`)}
                selected={topic === option}
                onPress={() => setTopic(topic === option ? null : option)}
              />
            ))}
          </View>
          <TextField
            label={t('booking.note')}
            helper={t('booking.note_helper')}
            value={note}
            onChangeText={setNote}
            maxLength={200}
            multiline
          />

          {slot ? (
            <Text weight="medium">
              {t('booking.summary', {
                when,
                minutes,
                office: officeText(professor.office, t),
              })}
            </Text>
          ) : null}
          <View accessibilityLiveRegion="polite" role={message ? 'alert' : undefined}>
            {message ? <Text color="danger">{message}</Text> : null}
          </View>
          <Button
            label={
              book.isPending
                ? t('booking.booking')
                : slot
                  ? t('booking.confirm', { time: clockText(slot.local_time, t), minutes })
                  : t('booking.choose_time')
            }
            onPress={confirm}
            disabled={!slot || book.isPending}
            block
          />
        </>
      )}
    </BottomSheet>
  );
}

/** The signature moment: the door swings open, then a check and the summary. */
function BookedMoment({ text, onDone }: { text: string; onDone: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Mount closed, then open, so the door animation plays.
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <View style={styles.moment}>
      <View style={styles.doorWithCheck}>
        <Door status={open ? 'in_office' : 'away'} size={88} />
        {open ? (
          <View
            style={[
              styles.check,
              insetEnd(-4, i18n.language === 'ar' ? 'ar' : 'en'),
              { backgroundColor: colors.status.in_office },
            ]}
          >
            <Check color={colors.surface} size={20} strokeWidth={3} />
          </View>
        ) : null}
      </View>
      <Text variant="title" style={styles.center} accessibilityLiveRegion="polite">
        {text}
      </Text>
      <Text color="muted" style={styles.center}>
        {t('booking.awaiting')}
      </Text>
      <Button label={t('booking.done')} onPress={onDone} block />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  moment: { alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  doorWithCheck: { alignItems: 'center', justifyContent: 'center' },
  check: {
    position: 'absolute',
    bottom: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  grow: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
