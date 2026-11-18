/**
 * The student's answer to another time the professor suggested (owner request S5c,
 * 2026-11-18): Accept moves the appointment there (and approves it), Keep my time leaves it as
 * it was. The professor is told either way. If someone booked the suggested time meanwhile,
 * Accept says so and nothing changes.
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAnswerProposal } from '@/api/queries';
import type { Appointment } from '@/api/types';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';
import { errorKey } from '@/lib/errors';
import { clockText, riyadhTime } from '@/lib/format';
import { professorName } from '@/lib/names';
import { space, type Language } from '@/theme/tokens';
import { appointmentWhen } from './AppointmentCard';

export function ProposalAnswer({ appointment, now }: { appointment: Appointment; now: Date }) {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const toast = useToast();
  const answer = useAnswerProposal();
  if (!appointment.proposed_starts_at) return null;
  const name = professorName(appointment.professor, language, t);
  const time = clockText(riyadhTime(new Date(appointment.proposed_starts_at)), t);
  const when = appointmentWhen({ starts_at: appointment.proposed_starts_at }, now, t);

  const reply = (accept: boolean) =>
    answer.mutate(
      { id: appointment.appointment_id, accept },
      {
        onSuccess: () =>
          toast(
            t(accept ? 'appointments.proposal_accepted' : 'appointments.proposal_kept', {
              when,
              name,
            }),
          ),
        onError: (error) => toast(t(errorKey(error))),
      },
    );

  return (
    <View style={styles.row}>
      <Button
        label={t('appointments.proposal_accept', { time })}
        accessibilityLabel={t('appointments.proposal_accept_label', { when, name })}
        disabled={answer.isPending}
        onPress={() => reply(true)}
      />
      <Button
        variant="secondary"
        label={t('appointments.proposal_keep')}
        disabled={answer.isPending}
        onPress={() => reply(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
