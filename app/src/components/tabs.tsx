/**
 * Shared tab styling for the student, professor and admin areas (DESIGN.md Section 6): a bottom
 * tab bar on phones and tablets, a side rail on desktop (docs/desktop-plan.md, Section 2). The
 * rail sits at the start edge: React Navigation's "left" follows the page direction on the web.
 * The current tab is marked three ways (DESIGN.md Section 11): colour, a heavier label, and a
 * filled pill behind its icon; in the rail, which is the corridor's navy, a raised plate.
 */
import type { ComponentProps, ComponentType } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import type { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TFunction } from 'i18next';

import { useLayout } from '@/lib/layout';
import { spokenList } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radii, space } from '@/theme/tokens';
import { Text } from './Text';

// Room for the icon in its pill and a caption label at up to 130% text size (TAB_LABEL_SCALE).
const TAB_BAR_HEIGHT = 76;
const PILL = { width: 56, height: 32 };
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
      tabBarActiveTintColor: colors.onBand,
      tabBarInactiveTintColor: colors.onBandMuted,
      tabBarActiveBackgroundColor: colors.bandRaised,
      // The busy red made for words on the band: the plain danger red is too dark to see there.
      tabBarBadgeStyle: { backgroundColor: colors.bandStatusText.busy, color: colors.band },
      tabBarStyle: {
        backgroundColor: colors.band,
        borderColor: colors.band,
        // React Navigation gives a side bar at least 360 wide; the rail is narrower on purpose.
        width: layout.rail,
        minWidth: layout.rail,
        maxWidth: layout.rail,
        paddingTop: space.lg,
      },
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
    tabBarLabel: ({ children, color, focused }) => (
      <Text
        variant="caption"
        weight={focused ? 'semibold' : 'medium'}
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

interface TabIconProps {
  focused: boolean;
  color: ColorValue;
  size: number;
}

/** A Lucide icon as a tab icon, in the tab's colour and the app's 1.75 stroke. */
export function tabIcon(Icon: Icon) {
  return function TabIcon(props: TabIconProps) {
    return <TabIconPill Icon={Icon} {...props} />;
  };
}

/**
 * The icon of one tab; in the bottom bar the current tab's icon sits on a filled pill, in the
 * side rail (desktop, unless `rail` says otherwise) the whole item is raised instead.
 */
export function TabIconPill({
  Icon,
  focused,
  color,
  size,
  rail: asRail,
}: TabIconProps & { Icon: Icon; rail?: boolean }) {
  const { colors } = useTheme();
  const desktop = useLayout() === 'desktop';
  const rail = asRail ?? desktop;
  const icon = <Icon color={String(color)} size={size} strokeWidth={focused ? 2.25 : 1.75} />;
  if (rail) return icon;
  return (
    <View style={[styles.pill, { backgroundColor: focused ? colors.tint : 'transparent' }]}>
      {icon}
    </View>
  );
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
  pill: { ...PILL, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
});
