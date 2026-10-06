/**
 * Notifications (DESIGN.md 7.9): today's and earlier ones, newest first, each opening its
 * source (the appointment list or the conversation) and marked read when opened. The
 * settings filter (appointments, messages) decides what this phone shows.
 */
import { SectionList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';

import { useMarkNotificationsRead } from '@/api/queries';
import type { AppNotification } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { EmptyState, SkeletonRow } from '@/components/Placeholders';
import { IconButton, ListRow, Pill } from '@/components/Surfaces';
import { Text } from '@/components/Text';
import { appointmentWhen } from '@/features/appointments/AppointmentCard';
import { SectionError } from '@/features/home/HomeParts';
import { useVisibleNotifications } from '@/features/notifications/useVisibleNotifications';
import { errorKey } from '@/lib/errors';
import { riyadhDayDifference, shortWhen } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { participantName, spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { space, type Language } from '@/theme/tokens';

export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const user = useUser();
  const { query, visible, hidden, unread } = useVisibleNotifications();
  const markRead = useMarkNotificationsRead();
  // Icons are drawings: layout direction moves them but never mirrors them, so the back
  // arrow is flipped for Arabic on every platform.
  const flip = language === 'ar';

  const text = (n: AppNotification) => {
    const name = n.actor ? participantName(n.actor, language, t) : '';
    const when = n.starts_at ? appointmentWhen({ starts_at: n.starts_at }, now, t) : '';
    return t(`notifications.${n.type}`, { name, when });
  };

  const open = (n: AppNotification) => {
    if (!n.read_at) markRead.mutate([n.notification_id]);
    if (n.type === 'new_message' && n.conversation_id) {
      router.push(`/conversations/${n.conversation_id}`);
    } else {
      router.navigate(user.role === 'professor' ? '/staff/requests' : '/appointments');
    }
  };

  const sections = [
    {
      title: t('notifications.today'),
      data: visible.filter((n) => riyadhDayDifference(new Date(n.created_at), now) === 0),
    },
    {
      title: t('notifications.earlier'),
      data: visible.filter((n) => riyadhDayDifference(new Date(n.created_at), now) !== 0),
    },
  ].filter((section) => section.data.length > 0);

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + space.xs }]}>
        <IconButton
          label={t('prof.back')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          icon={
            <View style={flip ? styles.flipped : undefined}>
              <ChevronLeft color={colors.text} size={26} strokeWidth={1.75} />
            </View>
          }
        />
        <Text variant="heading" role="heading" style={styles.grow}>
          {t('notifications.title')}
        </Text>
        {unread ? (
          <Button
            variant="quiet"
            label={t('notifications.mark_all')}
            onPress={() => markRead.mutate(null)}
          />
        ) : null}
      </View>
      <SectionList
        contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + space.xl }]}
        sections={sections}
        keyExtractor={(n) => String(n.notification_id)}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text variant="title" role="heading" style={styles.sectionTitle}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => {
          const title = text(item);
          const when = shortWhen(new Date(item.created_at), now, t);
          const fresh = !item.read_at;
          return (
            <ListRow
              title={title}
              subtitle={when}
              trailing={fresh ? <Pill label={t('notifications.new')} tone="primary" /> : null}
              accessibilityLabel={spokenList(
                [fresh ? t('notifications.new') : null, title, when],
                t,
              )}
              onPress={() => open(item)}
            />
          );
        }}
        ListFooterComponent={
          hidden > 0 ? (
            <Text variant="caption" color="muted" style={styles.footer}>
              {t('notifications.hidden')}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          query.data === undefined && !query.error ? (
            <View>
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : query.error && !query.data ? (
            <SectionError message={t(errorKey(query.error))} onRetry={() => query.refetch()} />
          ) : (
            <EmptyState title={t('notifications.empty')} />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1 },
  flipped: { transform: [{ scaleX: -1 }] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
  },
  page: { paddingHorizontal: space.md },
  sectionTitle: { marginTop: space.md, marginBottom: space.xs },
  footer: { marginTop: space.md },
});
