/**
 * Move an appointment earlier (CLAUDE.md Section 4): opened from the "time freed before
 * yours" notification. Lists the earlier free starts the same day where the appointment fits
 * with its length; the earliest is the one-tap choice. Length and approval stay the same, and
 * the professor is told.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useEarlierStarts, useMoveAppointment } from '@/api/queries';
import type { Appointment } from '@/api/types';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { SkeletonRow } from '@/components/Placeholders';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { errorKey } from '@/lib/errors';
import { clockText, riyadhTime } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { professorName } from '@/lib/names';
import { space, type Language } from '@/theme/tokens';
import { appointmentWhen } from './AppointmentCard';

interface MoveSheetProps {
  appointment: Appointment | null;
  onClose: () => void;
}

export function MoveSheet({ appointment, onClose }: MoveSheetProps) {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const now = useNow();
  const toast = useToast();
  const starts = useEarlierStarts(appointment?.appointment_id ?? null);
  const move = useMoveAppointment();
  const [chosen, setChosen] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const options = starts.data ?? [];
  const target = chosen && options.includes(chosen) ? chosen : (options[0] ?? null);
  const timeOf = (iso: string) => clockText(riyadhTime(new Date(iso)), t);

  const close = () => {
    setChosen(null);
    setMessage(null);
    onClose();
  };

  const confirm = () => {
    if (!appointment || !target) return;
    setMessage(null);
    move.mutate(
      { id: appointment.appointment_id, startsAt: target },
      {
        onSuccess: () => {
          toast(t('appointments.moved', { time: timeOf(target) }));
          close();
        },
        onError: (error) => {
          setMessage(t(errorKey(error)));
          setChosen(null);
          starts.refetch();
        },
      },
    );
  };

  return (
    <BottomSheet
      visible={appointment !== null}
      title={t('appointments.move_title')}
      onClose={close}
    >
      {appointment ? (
        <Text>
          {t('appointments.move_body', {
            name: professorName(appointment.professor, language, t),
            when: appointmentWhen(appointment, now, t),
          })}
        </Text>
      ) : null}
      {starts.data === undefined && !starts.error ? (
        <SkeletonRow />
      ) : starts.error ? (
        <Text color="danger">{t(errorKey(starts.error))}</Text>
      ) : options.length === 0 ? (
        <Text color="muted">{t('appointments.move_none')}</Text>
      ) : (
        <View style={styles.wrap}>
          {options.map((iso) => (
            <Chip
              key={iso}
              label={timeOf(iso)}
              selected={iso === target}
              onPress={() => setChosen(iso)}
            />
          ))}
        </View>
      )}
      <View accessibilityLiveRegion="polite" role={message ? 'alert' : undefined}>
        {message ? <Text color="danger">{message}</Text> : null}
      </View>
      <View style={styles.actions}>
        {target ? (
          <Button
            label={
              move.isPending
                ? t('appointments.moving')
                : t('appointments.move_to', { time: timeOf(target) })
            }
            onPress={confirm}
            disabled={move.isPending}
            block
          />
        ) : null}
        <Button variant="secondary" label={t('appointments.keep')} onPress={close} block />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  actions: { gap: space.sm },
});
