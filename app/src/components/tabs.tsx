/**
 * Shared tab styling for the student, professor and admin areas (DESIGN.md Section 6): a bottom
 * tab bar on phones and tablets, a side rail on desktop (docs/desktop-plan.md, Section 2). The
 * rail sits at the start edge: React Navigation's "left" follows the page direction on the web.
 */
import type { ComponentProps, ComponentType } from 'react';
import { StyleSheet, type ColorValue } from 'react-native';
import type { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TFunction } from 'i18next';

import { useLayout } from '@/lib/layout';
import { spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, space } from '@/theme/tokens';
import { Text } from './Text';

// Room for a 24 icon and a caption label at up to 130% text size (TAB_LABEL_SCALE).
const TAB_BAR_HEIGHT = 72;
// Like the system tab bars on iOS and Android, tab labels grow only a little with the
// system text size, so they are never clipped; every screen's own text still scales to 200%.
const TAB_LABEL_SCALE = 1.3;

type TabOptions = Exclude<
  NonNullable<ComponentProps<typeof Tabs.Screen>['options']>,
  (...args: never[]) => unknown
>;

export function useTabOptions(): TabOptions {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const rail = useLayout() === 'desktop';
  const shared = {
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.muted,
    tabBarBadgeStyle: { backgroundColor: colors.danger, color: colors.onPrimary },
    sceneStyle: { backgroundColor: colors.bg },
  } satisfies TabOptions;
  if (rail) {
    return {
      ...shared,
      tabBarPosition: 'left',
      tabBarVariant: 'material',
      tabBarLabelPosition: 'beside-icon',
      tabBarActiveBackgroundColor: colors.bg,
      tabBarStyle: {
        backgroundColor: colors.surface,
        borderColor: colors.line,
        // React Navigation gives a side bar at least 360 wide; the rail is narrower on purpose.
        width: layout.rail,
        minWidth: layout.rail,
        maxWidth: layout.rail,
        paddingTop: space.lg,
      },
      // The current tab is marked by weight and background as well as colour.
      tabBarLabel: ({ children, color, focused }) => (
        <Text
          variant="label"
          weight={focused ? 'semibold' : 'medium'}
          appScale={false}
          numberOfLines={1}
          style={[styles.railLabel, { color }]}
        >
          {children}
        </Text>
      ),
    };
  }
  return {
    ...shared,
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
        appScale={false}
        maxFontSizeMultiplier={TAB_LABEL_SCALE}
        // Five tabs on a 360 dp phone leave about 72 dp each: a long label ("Appointments")
        // shrinks a little instead of running into its neighbour.
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={{ color }}
      >
        {children}
      </Text>
    ),
    tabBarLabelPosition: 'below-icon',
  };
}

type Icon = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

/** A Lucide icon as a tab icon, in the tab's colour and the app's 1.75 stroke. */
export function tabIcon(Icon: Icon) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Icon color={String(color)} size={size} strokeWidth={1.75} />;
  };
}

/**
 * The unread-messages badge on the Messages tab (nothing when there is none). The tab is named
 * "Messages, 2 unread" so screen readers do not read the badge number before the name.
 */
export function messagesBadge(count: number | undefined, t: TFunction) {
  if (!count) return {};
  return {
    tabBarBadge: count > 99 ? '99+' : count,
    tabBarAccessibilityLabel: spokenList([t('tabs.messages'), t('chat.unread', { count })], t),
  };
}

const styles = StyleSheet.create({
  // Both sides: the web build does not flip marginStart for Arabic (lib/direction.ts).
  railLabel: { marginHorizontal: space.sm },
});
