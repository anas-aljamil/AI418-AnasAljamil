/**
 * One appointment as a ticket (DESIGN.md 7.6 and Section 11): the time large at the start edge
 * with its day, then who, the length, where, topic and note, and a state pill. Students see
 * the professor, professors the student. Actions (cancel, approve, ...) are passed in as
 * children and sit under the ticket's two parts. A professor's reason for declining or
 * cancelling shows as "Reason given", and another time the professor suggested shows until the
 * student answers (2026-11-18).
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Appointment } from '@/api/types';
import { Pill } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { Ticket } from '@/components/Ticket';
import { shortDateText, todayKey, weekdayOf } from '@/lib/dates';
import { clockText, dateTimeText, riyadhDayDifference, riyadhTime, whenText } from '@/lib/format';
import { fullName, officeText, professorName, scriptOf } from '@/lib/names';
import { space, type Language } from '@/theme/tokens';

interface AppointmentCardProps {
  appointment: Appointment;
  now: Date;
  perspective: 'student' | 'professor';
  children?: React.ReactNode;
}

/** "Sunday 10:30" within the two booking weeks, otherwise with the date. */
export function appointmentWhen(
  appointment: Pick<Appointment, 'starts_at'>,
  now: Date,
  t: Parameters<typeof whenText>[2],
) {
  const start = new Date(appointment.starts_at);
  const days = riyadhDayDifference(start, now);
  return days >= 0 && days < 14 ? whenText(start, now, t) : dateTimeText(start, t);
}

/** Cancel is offered for pending and approved appointments until the deadline. */
export function cancelState(appointment: Appointment, now: Date): 'open' | 'closed' | 'none' {
  if (appointment.status !== 'pending' && appointment.status !== 'approved') return 'none';
  return now < new Date(appointment.cancel_deadline) ? 'open' : 'closed';
}

/** The day under a ticket's time: "Today", "Tomorrow", the weekday, or the date further out. */
function dayLabel(start: Date, now: Date, t: Parameters<typeof whenText>[2]): string {
  const days = riyadhDayDifference(start, now);
  if (days === 0) return t('when.day_today');
  if (days === 1) return t('when.day_tomorrow');
  const date = todayKey(start);
  return days > 1 && days < 14 ? t(`weekday.${weekdayOf(date)}`) : shortDateText(date, t);
}

export function AppointmentCard({ appointment, now, perspective, children }: AppointmentCardProps) {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const who =
    perspective === 'student'
      ? professorName(appointment.professor, language, t)
      : fullName(appointment.student, language);
  const state = appointment.status;
  const start = new Date(appointment.starts_at);
  const reason = appointment.decline_reason ?? appointment.cancel_reason ?? null;
  const proposed = !!appointment.proposed_starts_at && !!appointment.proposed_ends_at;
  return (
    <Ticket
      stub={
        <>
          <Text variant="title" weight="bold">
            {clockText(riyadhTime(start), t)}
          </Text>
          <Text variant="caption" color="muted">
            {dayLabel(start, now, t)}
          </Text>
        </>
      }
      footer={children}
    >
      <Text variant="body" weight="semibold">
        {who}
      </Text>
      <Text variant="label" color="muted">
        {t('appointments.length_line', {
          end: clockText(riyadhTime(new Date(appointment.ends_at)), t),
          minutes: Math.round(
            (Date.parse(appointment.ends_at) - Date.parse(appointment.starts_at)) / 60_000,
          ),
        })}
      </Text>
      <Text variant="label" color="muted">
        {officeText(appointment.professor.office, t)}
      </Text>
      {appointment.topic ? (
        <Text variant="label" color="muted">
          {t('appointments.topic_line', { topic: t(`booking.topic_${appointment.topic}`) })}
        </Text>
      ) : null}
      {appointment.note ? (
        <Text variant="label" color="muted">
          {appointment.note}
        </Text>
      ) : null}
      {reason ? (
        <View>
          <Text variant="label" weight="semibold">
            {t('appointments.decline_reason_label')}
          </Text>
          <Text variant="label" lang={scriptOf(reason)}>
            {reason}
          </Text>
        </View>
      ) : null}
      {proposed ? (
        <View accessibilityLiveRegion="polite">
          <Text variant="label" weight="semibold" color="primary">
            {t(
              perspective === 'student'
                ? 'appointments.proposed_label'
                : 'appointments.proposed_label_professor',
              { name: who },
            )}
          </Text>
          <Text variant="label">
            {t('appointments.proposed_time', {
              when: appointmentWhen({ starts_at: appointment.proposed_starts_at! }, now, t),
              end: clockText(riyadhTime(new Date(appointment.proposed_ends_at!)), t),
            })}
          </Text>
        </View>
      ) : null}
      <View style={styles.state}>
        <Pill
          label={t(`appointments.state_${state}`)}
          tone={state === 'approved' || state === 'completed' ? 'primary' : 'muted'}
        />
      </View>
    </Ticket>
  );
}

const styles = StyleSheet.create({
  state: { marginTop: space.xxs },
});
