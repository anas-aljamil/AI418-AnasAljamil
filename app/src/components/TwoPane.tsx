/**
 * List plus detail on desktop (DESIGN.md Section 6; docs/desktop-plan.md, Section 3): the list
 * on the start side, the selected item on the end side. The selection lives in the URL (?id=12),
 * so a reload or a shared link opens the same item. Phones and tablets never render this.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';
import { layout, space } from '@/theme/tokens';
import { Text } from './Text';

export function TwoPane({ list, detail }: { list: ReactNode; detail: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.bg }]}>
      <View style={[styles.list, { borderColor: colors.line }]}>{list}</View>
      <View style={styles.detail}>{detail}</View>
    </View>
  );
}

/** The end pane before anything is chosen: says what to do. */
export function EmptyPane({ message }: { message: string }) {
  return (
    <View style={styles.empty}>
      <Text color="muted" style={styles.center}>
        {message}
      </Text>
    </View>
  );
}

/** The selected item's id from ?id=, and a setter that updates the URL. */
export function useSelectedId(): [number | null, (id: number | null) => void] {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const selected = id ? Number(id) || null : null;
  const select = (next: number | null) =>
    router.setParams({ id: next === null ? undefined : String(next) });
  return [selected, select];
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  list: { width: layout.listPane, borderEndWidth: StyleSheet.hairlineWidth },
  detail: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  center: { textAlign: 'center' },
});
