/** The bell in the Home and My status headers (DESIGN.md 7.2) with the unread count. */
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Bell from 'lucide-react-native/icons/bell';

import { insetEnd } from '@/lib/direction';
import { useVisibleNotifications } from '@/features/notifications/useVisibleNotifications';
import { useTheme } from '@/theme/ThemeProvider';
import { radii } from '@/theme/tokens';
import { IconButton } from './Surfaces';
import { Text } from './Text';

export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'ar' ? 'ar' : 'en';
  const { colors } = useTheme();
  const { unread } = useVisibleNotifications();
  return (
    <IconButton
      label={unread ? t('notifications.open', { count: unread }) : t('notifications.open_none')}
      onPress={() => router.push('/notifications')}
      icon={
        <View>
          <Bell color={colors.text} size={24} strokeWidth={1.75} />
          {unread ? (
            <View
              style={[styles.badge, insetEnd(-8, language), { backgroundColor: colors.danger }]}
            >
              <Text
                variant="caption"
                color="onPrimary"
                weight="semibold"
                appScale={false}
                maxFontSizeMultiplier={1}
                style={styles.badgeText}
              >
                {unread > 9 ? '9+' : String(unread)}
              </Text>
            </View>
          ) : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    minWidth: 18,
    height: 18,
    borderRadius: radii.pill,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A fixed small size so the count fits the dot; the bell's label says the number too.
  badgeText: { fontSize: 11, lineHeight: 14 },
});
