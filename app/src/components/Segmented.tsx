/** Two or more mutually exclusive views of one list (e.g. Upcoming / Past), as tabs. */
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radii, space, touchTarget } from '@/theme/tokens';
import { Text } from './Text';

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  const { colors } = useTheme();
  return (
    <View role="tablist" style={[styles.track, { backgroundColor: colors.line }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            role="tab"
            aria-selected={selected}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && { backgroundColor: colors.surface }]}
          >
            <Text variant="label" weight={selected ? 'semibold' : 'medium'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radii.input, padding: space.xxs, gap: space.xxs },
  segment: {
    flex: 1,
    minHeight: touchTarget - space.xs,
    borderRadius: radii.input - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
