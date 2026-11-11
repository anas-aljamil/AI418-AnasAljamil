/**
 * Requests: booking requests waiting for the professor (Approve / Decline), then approved
 * upcoming appointments (Completed / No-show once they have started).
 */
import { SectionList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRequests } from '@/api/queries';
import { SkeletonRow } from '@/components/Placeholders';
import { Text } from '@/components/Text';
import { AppointmentCard } from '@/features/appointments/AppointmentCard';
import { RequestActions } from '@/features/appointments/RequestActions';
import { SectionError } from '@/features/home/HomeParts';
import { errorKey } from '@/lib/errors';
import { useNow } from '@/lib/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function RequestsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const requests = useRequests();
  const all = requests.data ?? [];
  const sections = [
    { title: t('requests.waiting'), data: all.filter((a) => a.status === 'pending') },
    { title: t('requests.approved'), data: all.filter((a) => a.status === 'approved') },
  ].filter((section) => section.data.length > 0);

  return (
    <SectionList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}
      sections={sections}
      keyExtractor={(appointment) => String(appointment.appointment_id)}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <Text variant="heading" role="heading" style={styles.heading}>
          {t('requests.title')}
        </Text>
      }
      renderSectionHeader={({ section }) => (
        <Text variant="title" role="heading" style={styles.sectionTitle}>
          {section.title}
        </Text>
      )}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      renderItem={({ item }) => (
        <AppointmentCard appointment={item} now={now} perspective="professor">
          <RequestActions appointment={item} now={now} />
        </AppointmentCard>
      )}
      ListEmptyComponent={
        requests.data === undefined && !requests.error ? (
          <View>
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : requests.error ? (
          <SectionError message={t(errorKey(requests.error))} onRetry={() => requests.refetch()} />
        ) : (
          <Text color="muted">{t('requests.empty')}</Text>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.md, paddingBottom: space.xl },
  heading: { marginBottom: space.sm },
  sectionTitle: { marginTop: space.md, marginBottom: space.sm },
  gap: { height: space.sm },
});
