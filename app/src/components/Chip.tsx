import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radii, space, touchTarget } from '@/theme/tokens';
import { Text } from './Text';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

/** Fully rounded choice chip (topics, filters, presets). The hit area is at least 48 high. */
export function Chip({ label, selected = false, onPress, disabled }: ChipProps) {
  const { colors } = useTheme();
  const visualHeight = 40;
  return (
    <Pressable
      accessibilityRole="button"
      aria-selected={selected}
      aria-disabled={!!disabled}
      onPress={onPress}
      disabled={disabled}
      hitSlop={(touchTarget - visualHeight) / 2}
      style={({ pressed }) => [
        styles.chip,
        {
          minHeight: visualHeight,
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.line,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text variant="label" color={selected ? 'onPrimary' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: space.md,
    justifyContent: 'center',
  },
});
