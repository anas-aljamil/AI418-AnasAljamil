/**
 * My appointments (DESIGN.md 7.6): Upcoming and Past. Upcoming pending or approved
 * appointments can be cancelled, with a confirmation, until 1 hour before they start;
 * inside that window the button stays visible but disabled, and the reason is shown.
 */
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppointmentAction, useAppointments } from '@/api/queries';
import type { Appointment } from '@/api/types';
import { Button } from '@/components/Button';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { EmptyState, SkeletonRow } from '@/components/Placeholders';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import {
  AppointmentCard,
  appointmentWhen,
  cancelState,
} from '@/features/appointments/AppointmentCard';
import { SectionError } from '@/features/home/HomeParts';
import { errorKey } from '@/lib/errors';
import { useNow } from '@/lib/hooks';
import { professorName } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { space, type Language } from '@/theme/tokens';

type Scope = 'upcoming' | 'past';

export default function AppointmentsScreen() {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const toast = useToast();
  const [scope, setScope] = useState<Scope>('upcoming');
  const list = useAppointments(scope);
  const action = useAppointmentAction();
  const [confirming, setConfirming] = useState<Appointment | null>(null);

  const cancel = () => {
    if (!confirming) return;
    action.mutate(
      { id: confirming.appointment_id, action: 'cancel' },
      {
        onSuccess: () => toast(t('appointments.cancelled')),
        onError: (error) => toast(t(errorKey(error))),
        onSettled: () => setConfirming(null),
      },
    );
  };

  const header = (
    <View style={styles.header}>
      <Text variant="heading" role="heading">
        {t('appointments.title')}
      </Text>
      <Segmented
        options={[
          { value: 'upcoming', label: t('appointments.upcoming') },
          { value: 'past', label: t('appointments.past') },
        ]}
        value={scope}
        onChange={setScope}
      />
    </View>
  );

  const empty =
    list.data === undefined && !list.error ? (
      <View>
        <SkeletonRow />
        <SkeletonRow />
      </View>
    ) : list.error ? (
      <SectionError message={t(errorKey(list.error))} onRetry={() => list.refetch()} />
    ) : scope === 'upcoming' ? (
      <EmptyState
        title={t('appointments.empty_upcoming_title')}
        body={t('appointments.empty_upcoming_body')}
        actionLabel={t('appointments.empty_upcoming_action')}
        onAction={() => router.navigate('/search')}
      />
    ) : (
      <Text color="muted">{t('appointments.empty_past')}</Text>
    );

  return (
    <>
      <FlatList
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}
        data={list.data ?? []}
        keyExtractor={(appointment) => String(appointment.appointment_id)}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        renderItem={({ item }) => {
          const state = scope === 'upcoming' ? cancelState(item, now) : 'none';
          return (
            <AppointmentCard appointment={item} now={now} perspective="student">
              {state === 'open' ? (
                <View style={styles.actions}>
                  <Button
                    variant="danger"
                    label={t('appointments.cancel')}
                    onPress={() => setConfirming(item)}
                  />
                  <Text variant="caption" color="muted">
                    {t('appointments.cancel_until', {
                      when: appointmentWhen({ ...item, starts_at: item.cancel_deadline }, now, t),
                    })}
                  </Text>
                </View>
              ) : state === 'closed' ? (
                <View style={styles.actions}>
                  <Button variant="danger" label={t('appointments.cancel')} disabled />
                  <Text variant="caption" color="muted">
                    {t('appointments.cancel_closed')}
                  </Text>
                </View>
              ) : null}
            </AppointmentCard>
          );
        }}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
      />
      <ConfirmSheet
        visible={confirming !== null}
        title={t('appointments.confirm_cancel_title')}
        body={
          confirming
            ? t('appointments.confirm_cancel_body', {
                name: professorName(confirming.professor, language, t),
                when: appointmentWhen(confirming, now, t),
              })
            : ''
        }
        confirmLabel={t('appointments.cancel')}
        cancelLabel={t('appointments.keep')}
        onConfirm={cancel}
        onCancel={() => setConfirming(null)}
        busy={action.isPending}
      />
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.md, paddingBottom: space.xl },
  header: { gap: space.md, paddingBottom: space.md },
  gap: { height: space.sm },
  actions: { gap: space.xxs, alignItems: 'flex-start', marginTop: space.xs },
});
