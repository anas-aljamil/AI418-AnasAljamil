/**
 * Booking (DESIGN.md 7.5): a bottom sheet with the day strip (Sunday-Thursday, this week and
 * next), time chips, optional topic and note, a summary, then the one orchestrated moment:
 * the door opens, a check appears, "Booked with Dr. X, Sunday 10:30", and a success haptic.
 *
 * Steps from the profile: Book, (day, defaulted to the first bookable day), time, confirm.
 * Unavailable times stay visible and say why when tapped. An error never clears the day,
 * topic or note; only a time that was just taken by someone else is unselected.
 */
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import Check from 'lucide-react-native/icons/check';

import { ApiError } from '@/api/client';
import { useBook, useSlots } from '@/api/queries';
import type { Appointment, ProfessorDetail, Slot, Topic } from '@/api/types';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Door } from '@/components/Door';
import { SkeletonRow } from '@/components/Placeholders';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { insetEnd } from '@/lib/direction';
import { errorKey } from '@/lib/errors';
import { bookingDays, clockText, whenText } from '@/lib/format';
import { officeText, professorName } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { space, type Language } from '@/theme/tokens';

const TOPICS: Topic[] = ['assignment', 'exam_review', 'advising', 'other'];

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
  const [day, setDay] = useState(days[0]?.date ?? null);
  const [slot, setSlot] = useState<Slot | null>(null);
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

  const chooseSlot = (option: Slot) => {
    if (option.available) {
      setSlot(option);
      setMessage(null);
    } else {
      setMessage(t(option.reason === 'past' ? 'booking.past' : 'booking.taken'));
    }
  };

  const confirm = () => {
    if (!slot) return;
    setMessage(null);
    book.mutate(
      {
        professor_id: professor.professor_id,
        starts_at: slot.starts_at,
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.row}>
              {days.map((option) => (
                <Chip
                  key={option.date}
                  label={t('booking.day_chip', {
                    day: t(`weekday_short.${option.weekday}`),
                    date: option.dayOfMonth,
                  })}
                  selected={day === option.date}
                  onPress={() => chooseDay(option.date)}
                />
              ))}
            </View>
          </ScrollView>

          <Text variant="label" role="heading">
            {t('booking.time')}
          </Text>
          {slots.data === undefined && !slots.error ? (
            <SkeletonRow />
          ) : slots.error ? (
            <Text color="danger">{t(errorKey(slots.error))}</Text>
          ) : slots.data?.slots.length ? (
            <View style={styles.wrap}>
              {slots.data.slots.map((option) => (
                <Chip
                  key={option.starts_at}
                  label={clockText(option.local_time, t)}
                  selected={slot?.starts_at === option.starts_at}
                  dimmed={!option.available}
                  // Said out loud too: the web build drops aria-disabled on a tappable chip.
                  accessibilityLabel={
                    option.available
                      ? undefined
                      : t('booking.unavailable_label', { time: clockText(option.local_time, t) })
                  }
                  onPress={() => chooseSlot(option)}
                />
              ))}
            </View>
          ) : (
            <Text color="muted">{t('booking.no_times')}</Text>
          )}

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
                minutes: professor.slot_minutes,
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
                  ? t('booking.confirm', { time: clockText(slot.local_time, t) })
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
  row: { flexDirection: 'row', gap: space.xs },
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
});
