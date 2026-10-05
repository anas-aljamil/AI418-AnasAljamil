/** Shared bottom-tab styling for the student, professor and admin areas (DESIGN.md Section 6). */
import type { ComponentProps, ComponentType } from 'react';
import type { ColorValue } from 'react-native';
import type { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
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
  return {
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
  };
}

type Icon = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

/** A Lucide icon as a tab icon, in the tab's colour and the app's 1.75 stroke. */
export function tabIcon(Icon: Icon) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Icon color={String(color)} size={size} strokeWidth={1.75} />;
  };
}
