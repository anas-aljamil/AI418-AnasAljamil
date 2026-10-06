import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { durations, pressScale, radii, space, touchTarget } from '@/theme/tokens';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  /** The visible label; say exactly what happens ("Book 10:30", "Send"). */
  label: string;
  variant?: ButtonVariant;
  icon?: React.ReactNode;
  /** Stretch to the container width (sticky bars, sheets). */
  block?: boolean;
}

/** Buttons with press feedback (scale 0.97, 120 ms), a 48 minimum target and a visible focus ring. */
export function Button({
  label,
  variant = 'primary',
  icon,
  block,
  disabled,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const filled = variant === 'primary';
  const tint = variant === 'danger' ? colors.danger : colors.primary;
  const textColor = filled ? 'onPrimary' : variant === 'danger' ? 'danger' : 'primary';

  const press = (to: number) => {
    if (!reduceMotion) scale.set(withTiming(to, { duration: durations.press }));
  };

  return (
    <Animated.View style={[block && styles.block, animated]}>
      <Pressable
        accessibilityRole="button"
        aria-disabled={!!disabled}
        disabled={disabled}
        onPressIn={() => press(pressScale)}
        onPressOut={() => press(1)}
        style={(state) => {
          // `focused` is reported on the web build (keyboard navigation).
          const focused = 'focused' in state && (state as { focused?: boolean }).focused;
          return [
            styles.base,
            {
              backgroundColor: filled ? tint : 'transparent',
              borderColor: variant === 'quiet' ? 'transparent' : tint,
              opacity: disabled ? 0.45 : 1,
            },
            focused && {
              outlineColor: colors.primary,
              outlineWidth: 2,
              outlineStyle: 'solid',
              outlineOffset: 2,
            },
          ];
        }}
        {...rest}
      >
        <View style={styles.content}>
          {icon}
          <Text variant="label" color={textColor}>
            {label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: { alignSelf: 'stretch' },
  base: {
    minHeight: touchTarget,
    borderRadius: radii.input,
    borderWidth: 1.5,
    paddingHorizontal: space.md,
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs },
});
