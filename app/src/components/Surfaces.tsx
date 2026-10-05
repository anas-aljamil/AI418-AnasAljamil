/** Card (self-contained objects only) and ListRow (everything listed). DESIGN.md Section 3. */
import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radii, space } from '@/theme/tokens';
import { Text } from './Text';

export function Card({ style, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }, style]}
      {...rest}
    />
  );
}

interface ListRowProps {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/** Flat row with a hairline below; the whole row is one target when pressable. */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  accessibilityLabel,
}: ListRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.line, backgroundColor: pressed ? colors.line : 'transparent' },
      ]}
    >
      {leading}
      <View style={styles.main}>
        <Text variant="body" weight="semibold" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    gap: space.xs,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.xxs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  main: { flex: 1, gap: 2 },
  // The status may wrap, but never squeezes the name below about 60% of the row.
  trailing: { maxWidth: '40%', flexShrink: 1 },
});
