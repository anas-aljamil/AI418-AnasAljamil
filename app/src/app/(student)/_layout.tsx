/**
 * Student tabs (DESIGN.md Section 6). P3c ships Home and Profile; Search, Appointments and
 * Messages join in P4 and P5. Only signed-in students get here.
 */
import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import House from 'lucide-react-native/icons/house';
import UserRound from 'lucide-react-native/icons/user-round';

import { useAuth } from '@/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/Text';
import { space } from '@/theme/tokens';

// Room for a 24 icon and a caption label at up to 130% text size (TAB_LABEL_SCALE).
const TAB_BAR_HEIGHT = 72;
// Like the system tab bars on iOS and Android, tab labels grow only a little with the
// system text size, so they are never clipped; every screen's own text still scales to 200%.
const TAB_LABEL_SCALE = 1.3;

export default function StudentTabs() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { state } = useAuth();
  const insets = useSafeAreaInsets();
  if (state.status !== 'signedIn' || state.user.role !== 'student') return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        // The bar sits above the home indicator / Android navigation bar.
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingTop: space.xxs,
          paddingBottom: insets.bottom + space.xxs,
        },
        tabBarLabel: ({ children, color }) => (
          <Text
            variant="caption"
            weight="medium"
            maxFontSizeMultiplier={TAB_LABEL_SCALE}
            style={{ color }}
          >
            {children}
          </Text>
        ),
        tabBarLabelPosition: 'below-icon',
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <House color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => (
            <UserRound color={color} size={size} strokeWidth={1.75} />
          ),
        }}
      />
    </Tabs>
  );
}
