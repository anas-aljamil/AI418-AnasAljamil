/**
 * The round marks at the start of a row: a person's initials (conversations, accounts) and an
 * icon for a kind of thing (notifications). Both are decorative: the row's own text names the
 * person or says what happened.
 */
import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radii } from '@/theme/tokens';
import { Text } from './Text';

const SIZE = 40;

/** A lucide icon component (imported one by one, as lint requires). */
export type IconComponent = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

/** "Noura Al-Harbi" -> "NH", "نورة الحربي" -> "نح": the article before a family name is skipped. */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/^(al-|ال)/i, ''))
    .filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

interface MarkProps {
  /** Outlined and grey: an account that is not active, a notification already read. */
  muted?: boolean;
  /** 40 by default; 56 beside a screen's heading. */
  size?: number;
}

function Mark({ muted, size = SIZE, children }: MarkProps & { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.mark,
        { width: size, height: size },
        muted
          ? { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }
          : { backgroundColor: colors.tint },
      ]}
    >
      {children}
    </View>
  );
}

/** A person's initials on the brand tint. Pass the plain name, without "Dr." in front. */
export function Initials({ name, muted, size }: MarkProps & { name: string }) {
  return (
    <Mark muted={muted} size={size}>
      <Text
        variant={size && size > SIZE ? 'body' : 'label'}
        weight="semibold"
        color={muted ? 'muted' : 'primary'}
      >
        {initialsOf(name)}
      </Text>
    </Mark>
  );
}

/** An icon on the brand tint, for rows that are about a thing and not a person. */
export function IconCircle({ icon: Icon, muted, size }: MarkProps & { icon: IconComponent }) {
  const { colors } = useTheme();
  return (
    <Mark muted={muted} size={size}>
      <Icon color={muted ? colors.muted : colors.primary} size={20} strokeWidth={1.75} />
    </Mark>
  );
}

const styles = StyleSheet.create({
  mark: { borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
});
