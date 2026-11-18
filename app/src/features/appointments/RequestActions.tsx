/**
 * What a professor can do with one appointment: approve or decline a request; cancel an
 * approved appointment until 1 hour before it starts; suggest another time for a request that
 * has not started (owner requests 2026-11-18, ProposeSheet); mark it completed or no-show once
 * it has started; message the student. Each button names the student and time for screen
 * readers, since several cards show the same labels. Decline and cancel ask first, in a
 * sheet, with room for an optional reason the student will see.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAppointmentAction, useOpenConversation, type AppointmentAction } from '@/api/queries';
import type { Appointment } from '@/api/types';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { errorKey } from '@/lib/errors';
import { fullName } from '@/lib/names';
import { space, type Language } from '@/theme/tokens';
import { appointmentWhen, cancelState } from './AppointmentCard';
import { ProposeSheet } from './ProposeSheet';

export function RequestActions({ appointment, now }: { appointment: Appointment; now: Date }) {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const toast = useToast();
  const action = useAppointmentAction();
  const name = fullName(appointment.student, language);
  const when = appointmentWhen(appointment, now, t);
  const [declining, setDeclining] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [reason, setReason] = useState('');
  const notStarted = now < new Date(appointment.starts_at);

  const openChat = useOpenConversation();
  const message = (
    <Button
      key="message"
      variant="quiet"
      label={t('chat.message')}
      accessibilityLabel={t('chat.message_label', { name })}
      disabled={openChat.isPending}
      onPress={() =>
        openChat.mutate(
          { student_id: appointment.student.user_id },
          {
            onSuccess: (conversation) =>
              router.push(`/conversations/${conversation.conversation_id}`),
            onError: (error) => toast(t(errorKey(error))),
          },
        )
      }
    />
  );

  const run = (kind: AppointmentAction, why?: string) =>
    action.mutate(
      { id: appointment.appointment_id, action: kind, reason: why },
      {
        onSuccess: () => {
          setDeclining(false);
          setCancelling(false);
          setReason('');
          toast(
            kind === 'approve'
              ? t('requests.approved_toast', { name, when })
              : kind === 'decline'
                ? t('requests.declined_toast', { name, when })
                : kind === 'cancel'
                  ? t('requests.cancelled_toast', { name, when })
                  : t('requests.updated_toast'),
          );
        },
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
      onPress={() =>
        kind === 'decline'
          ? setDeclining(true)
          : kind === 'cancel'
            ? setCancelling(true)
            : run(kind)
      }
    />
  );

  // Another time, for a request that has not started (a new one replaces an unanswered one).
  const suggest = notStarted ? (
    <Button
      key="propose"
      variant="secondary"
      label={t(appointment.proposed_starts_at ? 'requests.propose_again' : 'requests.propose')}
      accessibilityLabel={t('requests.action_label', {
        action: t(appointment.proposed_starts_at ? 'requests.propose_again' : 'requests.propose'),
        name,
        when,
      })}
      onPress={() => setProposing(true)}
    />
  ) : null;
  const proposeSheet = notStarted ? (
    <ProposeSheet
      // Each opening starts from the appointment's own day.
      key={proposing ? 'open' : 'closed'}
      appointment={appointment}
      visible={proposing}
      onClose={() => setProposing(false)}
    />
  ) : null;

  /** Decline and cancel ask first, with an optional reason the student sees. */
  const reasonSheet = (kind: 'decline' | 'cancel') => (
    <BottomSheet
      visible={kind === 'decline' ? declining : cancelling}
      title={t(kind === 'decline' ? 'requests.decline_title' : 'requests.cancel_title', { name })}
      onClose={() => (kind === 'decline' ? setDeclining(false) : setCancelling(false))}
    >
      <Text color="muted">
        {t(kind === 'decline' ? 'requests.decline_body' : 'requests.cancel_body', { when })}
      </Text>
      <TextField
        label={t('requests.decline_reason')}
        helper={t('requests.decline_reason_helper')}
        value={reason}
        onChangeText={setReason}
        maxLength={200}
      />
      <Button
        variant="danger"
        label={t(kind === 'decline' ? 'requests.decline_confirm' : 'appointments.cancel')}
        disabled={action.isPending}
        onPress={() => run(kind, reason)}
        block
      />
      {kind === 'cancel' ? (
        <Button
          variant="quiet"
          label={t('requests.cancel_keep')}
          onPress={() => setCancelling(false)}
          block
        />
      ) : null}
    </BottomSheet>
  );

  if (appointment.status === 'pending') {
    return (
      <View style={styles.row}>
        {button('approve', 'requests.approve', 'primary')}
        {button('decline', 'requests.decline', 'secondary')}
        {suggest}
        {message}
        {reasonSheet('decline')}
        {proposeSheet}
      </View>
    );
  }
  if (appointment.status === 'approved' && !notStarted) {
    return (
      <View style={styles.row}>
        {button('complete', 'requests.complete', 'secondary')}
        {button('no-show', 'requests.no_show', 'secondary')}
        {message}
      </View>
    );
  }
  // Before it starts: cancel until the same deadline as the student (1 hour before), or
  // suggest another time; the API tells the student either way.
  if (appointment.status === 'approved') {
    return (
      <View style={styles.row}>
        {cancelState(appointment, now) === 'open'
          ? button('cancel', 'requests.cancel', 'secondary')
          : null}
        {suggest}
        {message}
        {reasonSheet('cancel')}
        {proposeSheet}
      </View>
    );
  }
  return <View style={styles.row}>{message}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
});
