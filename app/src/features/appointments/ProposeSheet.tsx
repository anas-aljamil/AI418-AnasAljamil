/**
 * "Suggest another time" (owner request S5c, 2026-11-18): the professor offers the student a
 * different start for a pending or approved request. The same calendar and hour and minute
 * wheels as booking, over the professor's own booking times; the length stays, so a start
 * where it would not fit says "too short". The appointment's own time counts as free (it is
 * the one moving). Nothing moves until the student accepts; a new suggestion replaces one the
 * student has not answered yet.
 */
import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useProfessor, useProposeTime, useSlots } from '@/api/queries';
import type { Appointment, Slot } from '@/api/types';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Calendar } from '@/components/Calendar';
import { SkeletonRow } from '@/components/Placeholders';
import { Text } from '@/components/Text';
import { TimeWheel } from '@/components/TimeWheel';
import { useToast } from '@/components/Toast';
import { todayKey } from '@/lib/dates';
import { errorKey } from '@/lib/errors';
import { bookingDays, clockText, riyadhTime } from '@/lib/format';
import { fullName } from '@/lib/names';
import { type Language } from '@/theme/tokens';
import { appointmentWhen } from './AppointmentCard';

interface ProposeSheetProps {
  appointment: Appointment;
  visible: boolean;
  onClose: () => void;
}

export function ProposeSheet({ appointment, visible, onClose }: ProposeSheetProps) {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const toast = useToast();
  const name = fullName(appointment.student, language);
  const professorId = appointment.professor.user_id;
  const minutes = Math.round(
    (Date.parse(appointment.ends_at) - Date.parse(appointment.starts_at)) / 60_000,
  );
  const days = useMemo(() => bookingDays(new Date()), []);
  const profile = useProfessor(visible ? professorId : 0);
  const bookable = new Set(profile.data?.booking_days ?? []);
  const [day, setDay] = useState<string | null>(todayKey(new Date(appointment.starts_at)));
  const [picked, setPicked] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const slots = useSlots(professorId, visible ? day : null, appointment.appointment_id);
  const propose = useProposeTime();

  // A start counts only if the whole appointment fits there; its current start is not a choice.
  const daySlots: Slot[] = (slots.data?.slots ?? []).map((slot) => {
    if (slot.starts_at === appointment.starts_at) {
      return { ...slot, available: false, reason: 'taken' };
    }
    if (slot.available && slot.max_minutes < minutes) {
      return { ...slot, available: false, reason: 'short' };
    }
    return slot;
  });
  const chosen =
    daySlots.find((slot) => slot.starts_at === picked && slot.available) ??
    daySlots.find((slot) => slot.available) ??
    null;

  const send = () => {
    if (!chosen) return;
    setProblem(null);
    propose.mutate(
      { id: appointment.appointment_id, starts_at: chosen.starts_at },
      {
        onSuccess: (updated) => {
          toast(
            t('requests.proposed_toast', {
              name,
              when: appointmentWhen({ starts_at: updated.proposed_starts_at ?? '' }, new Date(), t),
            }),
          );
          onClose();
        },
        onError: (error) => setProblem(t(errorKey(error))),
      },
    );
  };

  return (
    <BottomSheet visible={visible} title={t('requests.propose_title', { name })} onClose={onClose}>
      <Text color="muted">
        {t('requests.propose_body', {
          when: appointmentWhen(appointment, new Date(), t),
          minutes,
        })}
      </Text>
      <Text variant="label" role="heading">
        {t('booking.day')}
      </Text>
      {days.length ? (
        <Calendar
          label={t('booking.day')}
          value={day}
          onChange={(date) => {
            setDay(date);
            setPicked(null);
          }}
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
      ) : daySlots.some((slot) => slot.available) ? (
        <>
          <TimeWheel slots={daySlots} value={chosen?.starts_at ?? null} onChange={setPicked} />
          {chosen ? (
            <Text weight="semibold" style={styles.center} accessibilityLiveRegion="polite">
              {t('requests.propose_until', {
                start: clockText(chosen.local_time, t),
                end: clockText(
                  riyadhTime(new Date(Date.parse(chosen.starts_at) + minutes * 60_000)),
                  t,
                ),
              })}
            </Text>
          ) : null}
        </>
      ) : (
        <Text color="muted">{t('requests.propose_none')}</Text>
      )}
      <Text role={problem ? 'alert' : undefined} color="danger" accessibilityLiveRegion="polite">
        {problem ?? ''}
      </Text>
      <Button
        label={
          chosen
            ? t('requests.propose_send', { time: clockText(chosen.local_time, t) })
            : t('requests.propose_choose')
        }
        disabled={!chosen || propose.isPending}
        onPress={send}
        block
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
});
