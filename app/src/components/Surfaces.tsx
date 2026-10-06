/** Card (self-contained objects only) and ListRow (everything listed). DESIGN.md Section 3. */
import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radii, space, touchTarget } from '@/theme/tokens';
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
  /** A separate control after the row (e.g. a pin button); screen readers reach it on its own. */
  after?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * Flat row with a hairline below. The content (door, text, status) is one target and one
 * screen-reader element; an `after` control sits beside it rather than inside it, because a
 * control nested in an accessible element cannot be reached on iOS.
 */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  after,
  onPress,
  accessibilityLabel,
}: ListRowProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.line }]}>
      <Pressable
        disabled={!onPress}
        onPress={onPress}
        accessible
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.content,
          { backgroundColor: pressed ? colors.line : 'transparent' },
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
      {after}
    </View>
  );
}

/** A small outlined label for states such as "Waiting for approval". */
export function Pill({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'primary' }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, { borderColor: tone === 'primary' ? colors.primary : colors.line }]}>
      <Text variant="caption" color={tone} weight="medium">
        {label}
      </Text>
    </View>
  );
}

interface IconButtonProps {
  icon: React.ReactNode;
  /** Names the action ("Pin Dr. Noura"); the icon itself is hidden from screen readers. */
  label: string;
  onPress: () => void;
  selected?: boolean;
}

/** A 48 x 48 icon-only button (DESIGN.md Section 6 touch targets). */
export function IconButton({ icon, label, onPress, selected }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-selected={selected}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: pressed ? colors.line : 'transparent' },
      ]}
    >
      {icon}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flex: 1,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.xxs,
  },
  main: { flex: 1, gap: 2 },
  // The status may wrap, but never squeezes the name below about 60% of the row.
  trailing: { maxWidth: '40%', flexShrink: 1 },
  pill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: space.xs,
    paddingVertical: 2,
  },
  iconButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
