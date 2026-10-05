/**
 * What a professor can do with one appointment: approve or decline a request, and mark an
 * approved appointment completed or no-show once it has started. Each button names the student
 * and time for screen readers, since several cards show the same labels.
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAppointmentAction, type AppointmentAction } from '@/api/queries';
import type { Appointment } from '@/api/types';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';
import { errorKey } from '@/lib/errors';
import { fullName } from '@/lib/names';
import { space, type Language } from '@/theme/tokens';
import { appointmentWhen } from './AppointmentCard';

export function RequestActions({ appointment, now }: { appointment: Appointment; now: Date }) {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const toast = useToast();
  const action = useAppointmentAction();
  const name = fullName(appointment.student, language);
  const when = appointmentWhen(appointment, now, t);

  const run = (kind: AppointmentAction) =>
    action.mutate(
      { id: appointment.appointment_id, action: kind },
      {
        onSuccess: () =>
          toast(
            kind === 'approve'
              ? t('requests.approved_toast', { name, when })
              : kind === 'decline'
                ? t('requests.declined_toast', { name, when })
                : t('requests.updated_toast'),
          ),
        onError: (error) => toast(t(errorKey(error))),
      },
    );

  const button = (kind: AppointmentAction, labelKey: string, variant: 'primary' | 'secondary') => (
    <Button
      key={kind}
      variant={variant}
      label={t(labelKey)}
      accessibilityLabel={t('requests.action_label', { action: t(labelKey), name, when })}
      disabled={action.isPending}
      onPress={() => run(kind)}
    />
  );

  if (appointment.status === 'pending') {
    return (
      <View style={styles.row}>
        {button('approve', 'requests.approve', 'primary')}
        {button('decline', 'requests.decline', 'secondary')}
      </View>
    );
  }
  if (appointment.status === 'approved' && now >= new Date(appointment.starts_at)) {
    return (
      <View style={styles.row}>
        {button('complete', 'requests.complete', 'secondary')}
        {button('no-show', 'requests.no_show', 'secondary')}
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
});
