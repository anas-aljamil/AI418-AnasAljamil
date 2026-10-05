/**
 * One appointment as a card (DESIGN.md 7.6; cards are for self-contained objects): who, when,
 * where, topic and note, and a state pill. Students see the professor, professors the student.
 * Actions (cancel, approve, ...) are passed in as children.
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Appointment } from '@/api/types';
import { Card, Pill } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { dateTimeText, riyadhDayDifference, whenText } from '@/lib/format';
import { fullName, officeText, professorName } from '@/lib/names';
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

export function AppointmentCard({ appointment, now, perspective, children }: AppointmentCardProps) {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const who =
    perspective === 'student'
      ? professorName(appointment.professor, language, t)
      : fullName(appointment.student, language);
  const state = appointment.status;
  return (
    <Card>
      <View style={styles.top}>
        <Text variant="body" weight="semibold" style={styles.grow}>
          {who}
        </Text>
        <Pill
          label={t(`appointments.state_${state}`)}
          tone={state === 'approved' || state === 'completed' ? 'primary' : 'muted'}
        />
      </View>
      <Text>{appointmentWhen(appointment, now, t)}</Text>
      <Text color="muted">{officeText(appointment.professor.office, t)}</Text>
      {appointment.topic ? (
        <Text color="muted">
          {t('appointments.topic_line', { topic: t(`booking.topic_${appointment.topic}`) })}
        </Text>
      ) : null}
      {appointment.note ? <Text color="muted">{appointment.note}</Text> : null}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  grow: { flex: 1 },
});
