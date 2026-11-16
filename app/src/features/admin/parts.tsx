/**
 * Small pieces of the admin area: the icon square for departments and offices, the
 * overview's number tiles, the on/off switch row, and form section headings. (The initials
 * circle for people is components/Avatar.tsx.)
 */
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import type { IconComponent } from '@/components/Avatar';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, space, touchTarget } from '@/theme/tokens';

const AVATAR = 40;

export function IconSquare({ icon: Icon }: { icon: IconComponent }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.square, { borderColor: colors.line, backgroundColor: colors.surface }]}
    >
      <Icon color={colors.primary} size={22} strokeWidth={1.75} />
    </View>
  );
}

interface StatTileProps {
  icon: IconComponent;
  label: string;
  value: number | null;
  detail?: string | null;
  onPress?: () => void;
  /** The whole tile as one sentence ("Professors: 9, not active: 1"). */
  accessibilityLabel: string;
}

/** A number on the overview; tapping it opens the list it counts. */
export function StatTile({
  icon: Icon,
  label,
  value,
  detail,
  onPress,
  accessibilityLabel,
}: StatTileProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      role={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: pressed ? colors.line : colors.surface,
          borderColor: colors.line,
        },
      ]}
    >
      <Icon color={colors.primary} size={22} strokeWidth={1.75} />
      <Text variant="display" weight="semibold">
        {value ?? '–'}
      </Text>
      <Text variant="label" weight="medium">
        {label}
      </Text>
      {detail ? (
        <Text variant="caption" color="muted">
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}

interface SwitchRowProps {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

/** An on/off setting: the label and hint, and a switch that is also reached by tapping the row. */
export function SwitchRow({ label, hint, value, onChange }: SwitchRowProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.switchRow}>
      <View style={styles.grow}>
        <Text variant="label">{label}</Text>
        {hint ? (
          <Text variant="caption" color="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={hint}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.line }}
        thumbColor={colors.surface}
        // The web build draws the thumb with activeThumbColor.
        {...({ activeThumbColor: colors.surface } as object)}
      />
    </View>
  );
}

/** A heading that splits a form into parts (Account, Academic, Status). */
export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { borderTopColor: colors.line }]}>
      <Text variant="label" weight="semibold" color="muted" role="heading">
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  square: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: radii.input,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: touchTarget * 2,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    gap: space.xxs,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touchTarget },
  grow: { flex: 1, gap: 2 },
  section: { gap: space.md, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md },
});
