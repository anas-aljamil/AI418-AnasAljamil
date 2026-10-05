/** Loading skeletons shaped like the real rows, and the empty state (DESIGN.md Sections 4.4 and 5). */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme/ThemeProvider';
import { radii, space } from '@/theme/tokens';
import { Button } from './Button';
import { Text } from './Text';

/** A placeholder row: door, two text lines, a status. Pulses slowly unless motion is reduced. */
export function SkeletonRow() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!reduceMotion) opacity.set(withRepeat(withTiming(0.5, { duration: 900 }), -1, true));
  }, [reduceMotion, opacity]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const block = { backgroundColor: colors.line, borderRadius: radii.input / 2 };
  return (
    <Animated.View
      style={[styles.row, { borderBottomColor: colors.line }, pulse]}
      accessible
      accessibilityLabel={t('common.loading')}
      aria-busy
    >
      <View style={[block, { width: 32, height: 32 }]} />
      <View style={styles.lines}>
        <View style={[block, { width: '62%', height: 14 }]} />
        <View style={[block, { width: '40%', height: 10 }]} />
      </View>
      <View style={[block, { width: 64, height: 14 }]} />
    </Animated.View>
  );
}

interface EmptyStateProps {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** A line drawing of a corridor with a door (brand and neutral colours only) and one action. */
export function EmptyState({ title, body, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Svg
        width={120}
        height={96}
        viewBox="0 0 120 96"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Path
          d="M10 86h100M24 86V18l18 8v60M96 86V18l-18 8v60"
          stroke={colors.line}
          strokeWidth={1.75}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M50 86V40h20v46"
          stroke={colors.primary}
          strokeWidth={1.75}
          fill="none"
          strokeLinejoin="round"
        />
        <Path d="M64 63h.01" stroke={colors.primary} strokeWidth={3} strokeLinecap="round" />
      </Svg>
      <Text variant="title" style={styles.center}>
        {title}
      </Text>
      <Text color="muted" style={styles.center}>
        {body}
      </Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lines: { flex: 1, gap: space.xs },
  empty: {
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
  },
  center: { textAlign: 'center' },
});
